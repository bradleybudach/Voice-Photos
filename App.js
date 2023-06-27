import { Camera, CameraType } from 'expo-camera'
import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Button, Alert, ImageBackground, Image, Animated, ScrollView, BackHandler } from 'react-native';
import { PinchGestureHandler, GestureHandlerRootView, TapGestureHandler, State, PanGestureHandler } from 'react-native-gesture-handler';
import { Audio } from "expo-av";
import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system';
import { NavigationContainer, useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { writeExif } from './modules/exif-writer';

// globals:
const FILE_DIRECTORY = FileSystem.documentDirectory + "voicePhotos/";
const { Navigator, Screen } = createNativeStackNavigator();

// App Controls/UI:
export default function App() {
  const [cameraPermission, requestCameraPermission] = Camera.useCameraPermissions();
  const [audioPermission, requestAudioPermission] = Audio.usePermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();

  if (!cameraPermission || !audioPermission || !locationPermission) {
    // Camera/Audio permissions are still loading
    return <View />
  }

  if (!cameraPermission.granted || !audioPermission.granted || !locationPermission.granted) {
    // Camera/audio permissions are not granted yet

    return (
      <View style={styles.container}>
        <View style={{ padding: 40 }}>
          <Text style={{ textAlign: 'center', color: 'white', marginBottom: 20, fontSize: 18 }}>
            To use this app, we need your permission to show the camera, record audio, and access your location.
          </Text>
          <Button onPress={() => {
            if (!cameraPermission.granted) {
              requestCameraPermission();
            }
            if (!audioPermission.granted) {
              requestAudioPermission();
            }
            if (!locationPermission.granted) {
              requestLocationPermission();
            }
          }} title='grant permission' />
        </View>
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Navigator screenOptions={{ headerShown: false }}>
        <Screen name="Home" component={HomeScreen} />
        <Screen name="Files" component={FileDisplay} />
      </Navigator>
    </NavigationContainer>
  )
}

const HomeScreen = ({ navigation }) => {
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedAudio, setCapturedAudio] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [takingPicture, setTakingPicture] = useState(false);

  useEffect(() => {
    const backAction = () => { // back button handling
      if (imagePreviewVisible) {
        __retakePicture();
      } else {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );
        Alert.alert('Hold on!', 'Are you sure you want to exit the app?', [
          {
            text: 'Cancel',
            onPress: () => null,
            style: 'cancel',
          },
          { text: 'YES', onPress: () => BackHandler.exitApp() },
        ]);
      }
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [imagePreviewVisible]);

  const isFocused = useIsFocused();

  const camera = useRef(null);

  // Commands:
  let recording = null;
  const __startRecordAudio = async () => {
    recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
    await recording.startAsync();
  }

  const __endRecordAudio = async () => {
    try {
      await recording.stopAndUnloadAsync();
      setCapturedAudio(recording);
    } catch {
      console.log('Failed to record audio.');
    }

  }

  const __onPinchEvent = event => {
    let scale = event.nativeEvent.scale;
    let velocity = event.nativeEvent.velocity;

    if (Math.abs(velocity) > 0.0003) {
      if (velocity > 0) {
        setZoomLevel((zoomLevel + scale * 0.05).clamp(0, 1));
      } else {
        setZoomLevel((zoomLevel - scale * 0.07).clamp(0, 1));
      }
    }
  }

  const __takePicture = async () => {
    if (!camera) { return; }

    setTakingPicture(true);
    Haptics.selectionAsync();

    const [location, photo] = await Promise.all([
      Location.getCurrentPositionAsync({
        accuracy: 6,
      }),
      camera.current.takePictureAsync({ skipProcessing: true })
    ]);

    setImagePreviewVisible(true);
    setCapturedImage(photo);
    setTakingPicture(false);
    setZoomLevel(0);

    writeExif(photo.uri, location.coords.latitude, location.coords.longitude, location.coords.altitude);
  }

  const __retakePicture = () => {
    setCapturedImage(null);
    setCapturedAudio(null);
    setImagePreviewVisible(false);
  }

  const __saveFiles = async () => {
    if (!capturedImage) return;
    //FileSystem.deleteAsync(FILE_DIRECTORY);

    const directoryInfo = await FileSystem.getInfoAsync(FILE_DIRECTORY);
    if (!directoryInfo.exists) { // check if the main image directory exists or needs to be created.
      await FileSystem.makeDirectoryAsync(FILE_DIRECTORY);
    }

    let time = new Date(); // gets the current time
    let newFile = FILE_DIRECTORY + time.getMonth() + '.' + time.getDate() + '.' + time.getFullYear() + "/"; // creates file for the day

    const newFileInfo = await FileSystem.getInfoAsync(newFile); // gets info about the day file
    if (!newFileInfo.exists) { // if the file doesn't exist yet
      console.log("directory doesn't exist, creating...");
      await FileSystem.makeDirectoryAsync(newFile); // makes a file for the current time to store the audio and image
    }

    if (capturedAudio) { // if there is also an audio file to be stored
      let voicePhotoFile = newFile + time.getHours() + '.' + time.getMinutes() + '.' + time.getSeconds() + '/';
      await FileSystem.makeDirectoryAsync(voicePhotoFile);

      await FileSystem.moveAsync({ // stores the image in the file
        from: capturedImage.uri,
        to: voicePhotoFile + time.getHours() + '.' + time.getMinutes() + '.' + time.getSeconds() + '.jpg' // stores image with current hour+minute+second as name
      });

      await FileSystem.moveAsync({ // stores the audio in the file
        from: capturedAudio.getURI(),
        to: voicePhotoFile + time.getHours() + '.' + time.getMinutes() + '.' + time.getSeconds() + ".mp3"
      });
    } else {
      await FileSystem.moveAsync({ // stores the image in the file
        from: capturedImage.uri,
        to: newFile + time.getHours() + '.' + time.getMinutes() + '.' + time.getSeconds() + '.jpg' // stores image with current hour+minute+second as name
      });
    }

    // resets values and returns to camera:
    setCapturedImage(null);
    setImagePreviewVisible(false);
    setCapturedAudio(null);
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {imagePreviewVisible && capturedImage ? (
        <CameraPreview photo={capturedImage} audio={capturedAudio} retakePicture={__retakePicture} saveFiles={__saveFiles} recordAudio={__startRecordAudio} endRecording={__endRecordAudio} />
      ) : (
        <>
          <PinchGestureHandler onGestureEvent={__onPinchEvent}>
            <View style={styles.imageContainer}>
              {isFocused && <Camera ref={camera} ratio='16:9' zoom={zoomLevel} style={{ flex: 1 }} type={CameraType.back}>
                <View style={styles.zoomBarContainer}>
                  <View style={styles.zoomBar} height={zoomLevel * 100 + "%"}></View>
                </View>
                <TouchableOpacity style={[styles.button, {
                  position: 'absolute',
                  top: 15,
                  left: 15,
                }]} onPress={() => {
                  setZoomLevel(0);
                  navigation.navigate('Files');
                }}><Text style={styles.text}>Files</Text></TouchableOpacity>
              </Camera>}
            </View>
          </PinchGestureHandler>


          <View style={styles.bottomBorder}>
            <View
              style={{
                flex: 1,
                alignSelf: 'center',
                alignItems: 'center',
              }}
            >
              <TouchableOpacity
                onPress={__takePicture}
                style={takingPicture ? styles.takePictureButtonIsTaking : styles.takePictureButton}
              />
            </View>
          </View>
        </>
      )}
    </GestureHandlerRootView>
  )
}

const CameraPreview = ({ photo, audio, retakePicture, saveFiles, recordAudio, endRecording }) => {
  const [currentSound, setCurrentSound] = useState(null);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(true);
  const [playbackPercent, setPlaybackPercent] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => { // back button handling
    const backAction = () => {
      if (!isPlaybackPaused) {
        __stopPlayback();
      }

      return isRecording ? true : false; // prevent back button use when recording or return false so BackEvent propagates up to parent.
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [isPlaybackPaused, isRecording]);

  const __toggleRecording = () => {
    if (!isRecording) {
      __stopPlayback();
      setIsRecording(true);
      recordAudio();
    } else {
      setIsRecording(false);
      endRecording();
    }
  }

  const __stopPlayback = async () => {
    if (currentSound) { // if there is already a sound loaded, remove it
      await currentSound.sound.stopAsync();
      setPlaybackPercent(0);
      setCurrentSound(null);
    }
  }

  const __togglePlayback = async () => {
    if (!currentSound) { // if there is already a sound loaded, remove it
      setCurrentSound(await Audio.Sound.createAsync( // plays audio associated with the picture
        { uri: audio.getURI() },
        {
          shouldPlay: true,
          progressUpdateIntervalMillis: 100
        },
        onPlaybackStatusUpdate
      ));
      setIsPlaybackPaused(false);
    } else {
      const status = await currentSound.sound.getStatusAsync();
      if (!isPlaybackPaused) {
        await currentSound.sound.pauseAsync();
        setIsPlaybackPaused(true);
      } else {
        await currentSound.sound.playAsync();
        setIsPlaybackPaused(false);
      }
    }
  }

  const onPlaybackStatusUpdate = (playbackStatus) => {
    if (playbackStatus.isLoaded) {
      if (playbackStatus.didJustFinish) {
        setPlaybackPercent(0);
        setCurrentSound(null);
        setIsPlaybackPaused(true);
        return;
      }

      setPlaybackPercent(playbackStatus.positionMillis / playbackStatus.playableDurationMillis * 100);
    }
  }

  return (
    <View style={{
      flex: 1,
      width: '100%',
      height: '100%'
    }}>
      <ImageBackground source={{ uri: photo && photo.uri }} style={styles.imageContainer}>
        {(audio && !isRecording) ?
          <View style={{ width: '100%', backgroundColor: 'rgba(32, 32, 32, 0.5)', position: 'absolute', bottom: 0, flex: 1, flexDirection: 'row' }}>
            <View style={{ flex: 1, marginLeft: 15, alignItems: 'center', justifyContent: 'center' }}>
              <TouchableOpacity
                onPress={__togglePlayback}
                style={{
                  width: 50,
                  height: 50,
                  margin: 10,
                  backgroundColor: 'white',
                  borderRadius: 50,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 4,
                  borderColor: 'black'
                }}>
                <ImageBackground source={isPlaybackPaused ? require('./assets/playIcon.png') : require('./assets/stopIcon.png')} style={{ width: '100%', height: '100%' }} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 7, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ backgroundColor: 'gray', width: '90%', height: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'black' }}>
                <View width={playbackPercent + '%'} height={'100%'} style={{ backgroundColor: 'white' }} />
              </View>
            </View>
          </View> : <></>
        }
      </ImageBackground>
      <View style={styles.bottomBorder}>
        {!isRecording ?
          <TouchableOpacity
            onPress={() => {
              __stopPlayback();
              retakePicture();
            }}
            style={[styles.button, { flex: 1, alignSelf: 'center', margin: 20 }]}>
            <Text style={styles.text}>Retake</Text>
          </TouchableOpacity> : <></>
        }

        <TouchableOpacity
          onPress={__toggleRecording}
          style={{
            width: 70,
            height: 70,
            borderRadius: 50,
            overflow: 'hidden',
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'center',
            borderColor: 'gray',
            borderWidth: 4,
            backgroundColor: '#fff',
          }}
        ><ImageBackground source={isRecording ? require('./assets/stopIcon.png') : require('./assets/recordIcon.png')} style={{ width: '100%', height: '100%' }} /></TouchableOpacity>

        {!isRecording ?
          <TouchableOpacity
            onPress={() => {
              __stopPlayback();
              saveFiles();
            }}
            style={[styles.button, { flex: 1, alignSelf: 'center', margin: 20 }]}>
            <Text style={styles.text}>Save</Text>
          </TouchableOpacity> : <></>
        }

      </View>
    </View>
  )
}

const FileDisplay = ({ navigation }) => {
  const [images, setImages] = useState([]);
  const [viewedImage, setViewedImage] = useState(null);
  const [viewedAudio, setViewedAudio] = useState(null);
  const [scrollYPosition, setScrollYPosition] = useState(0);

  useEffect(() => {
    const backAction = () => {
      if (viewedImage) {
        __goBack();
      } else {
        navigation.navigate('Home');
      }
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [viewedImage]);

  useEffect(() => {
    __getImages();
  }, []);

  const __getImages = async () => {

    const dir = await FileSystem.getInfoAsync(FILE_DIRECTORY);
    if (!dir.exists) { // don't try to load images if the directory doesn't exist
      return;
    }

    let newArr = [];
    let files = await FileSystem.readDirectoryAsync(FILE_DIRECTORY);

    files.sort((a, b) => { // sort newest to oldest
      let timeA = a.split('.');
      let timeB = b.split('.');

      if (Math.abs(parseInt(timeB[2]) - parseInt(timeA[2])) > 0) { // compare by year
        return parseInt(timeB[2]) - parseInt(timeA[2]);
      } else if (Math.abs(parseInt(timeB[0]) - parseInt(timeA[0])) > 0) { // compare by month
        return parseInt(timeB[0]) - parseInt(timeA[0]);
      } else { // compare by day
        return parseInt(timeB[1]) - parseInt(timeA[1]);
      }
    });

    if (files.length > 0) {
      newArr = await Promise.all(files.map(async (file) => {
        let key = 0;
        let newFileString = FILE_DIRECTORY + file + "/";
        let subFile = await FileSystem.readDirectoryAsync(newFileString);
        subFile.sort((a, b) => { // sort newest to oldest
          let timeA = a.split('.');
          let timeB = b.split('.');

          if (Math.abs(parseInt(timeB[0]) - parseInt(timeA[0])) > 0) { // compare by hours
            return parseInt(timeB[0]) - parseInt(timeA[0]);
          } else if (Math.abs(parseInt(timeB[1]) - parseInt(timeA[1])) > 0) { // compare by minutes
            return parseInt(timeB[1]) - parseInt(timeA[1]);
          } else { // compare by seconds
            return parseInt(timeB[2]) - parseInt(timeA[2]);
          }
        });

        return [<View key={key} style={gridStyles.gridTitle}>
          <Text style={styles.text}>{file.replaceAll('.', '/')}</Text>
          <TouchableOpacity style={{ position: 'absolute', right: 10, backgroundColor: 'red', padding: 5, borderRadius: 10 }} onPress={() => {confirmDeleteDayAlert(file)}}>
            <Text>Del</Text>
          </TouchableOpacity>
        </View>,
        await Promise.all(subFile.map(async (file) => {
          key++;
          if (file.endsWith("jpg")) {
            const uri = (newFileString + file);
            return (
              <VoicePhoto key={key} uri={uri} tapEvent={__tapEvent} />
            );
          } else {
            const uri = newFileString + file + '/' + file + '.jpg';
            const audio = newFileString + file + '/' + file + '.mp3';
            return (
              <VoicePhoto key={key} uri={uri} audio={audio} tapEvent={__tapEvent} />
            );
          }
        }))];
      }));
    }

    setImages(newArr);
  }

  const __downloadFiles = async () => {
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) { return; }

    // Gets SAF URI from response
    let externalDirURI = permissions.directoryUri;

    let localFiles = await FileSystem.readDirectoryAsync(FILE_DIRECTORY);

    if (localFiles.length > 0) {
      localFiles.map(async (file) => {
        let newFileString = FILE_DIRECTORY + file + "/";
        let subFile = await FileSystem.readDirectoryAsync(newFileString);

        subFile.map(async (file) => {
          if (file.endsWith("jpg")) {
            const assetUri = (newFileString + file);
            file = file.replace('.jpg', '');

            let filesAlreadyExisting = await StorageAccessFramework.readDirectoryAsync(externalDirURI);

            if (filesAlreadyExisting.filter(f => f.endsWith(file + '.jpg')).length == 0) { // if the file doesn't yet exist
              try {
                await StorageAccessFramework.createFileAsync(externalDirURI, file, 'image/jpeg').then(async (uri) => {
                  await StorageAccessFramework.writeAsStringAsync(uri, await convertFileToB64(assetUri), { encoding: FileSystem.EncodingType.Base64 });
                });

              } catch (e) {
                console.log('file creation failed');
              }
            } else {
              console.log('file already exists');
            }
          } else {
            const assetUri = newFileString + file + '/' + file + '.jpg';
            const audioAssetURI = newFileString + file + '/' + file + '.mp3';

            let filesAlreadyExisting = await StorageAccessFramework.readDirectoryAsync(externalDirURI);

            if (filesAlreadyExisting.filter(f => f.endsWith(file + '.jpg')).length == 0) { // if the file doesn't yet exist
              try {
                await StorageAccessFramework.createFileAsync(externalDirURI, file, 'image/jpeg').then(async (uri) => {
                  await StorageAccessFramework.writeAsStringAsync(uri, await convertFileToB64(assetUri), { encoding: FileSystem.EncodingType.Base64 });
                });
              } catch (e) {
                console.log(e);
              }
            } else {
              console.log('file already exists');
            }

            if (filesAlreadyExisting.filter(f => f.endsWith(file + '.mp3')).length == 0) {
              try {
                await StorageAccessFramework.createFileAsync(externalDirURI, file, 'audio/mpeg').then(async (uri) => {
                  await StorageAccessFramework.writeAsStringAsync(uri, await convertFileToB64(audioAssetURI), { encoding: FileSystem.EncodingType.Base64 });
                });
              } catch (e) {
                console.log(e);
              }
            } else {
              console.log('file already exists');
            }
          }
        });
      });
    }


    const convertFileToB64 = async (localFilePath) => {
      const base64String = await FileSystem.readAsStringAsync(localFilePath, { encoding: FileSystem.EncodingType.Base64 });
      return base64String;
    }
  }

  const __tapEvent = (event, uri, audio) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      setViewedImage(uri);
      setViewedAudio(audio);
    }
  }

  const __deletePhoto = async () => {

    let str = viewedImage.split('/');
    const parentFolderURI = FILE_DIRECTORY + str[str.indexOf('voicePhotos') + 1]; // the folder name is the part that comes right after the voicePhotos folder

    if (viewedAudio) { // if there is audio to be deleted
      let directories = viewedAudio.split('/'); // splits URI into individual directories
      const entryPoint = directories.indexOf('voicePhotos'); // gets the location of the voicePhotos directory in the list as it is the entrypoint for other files

      let folderURI = parentFolderURI + '/' + directories[entryPoint + 2]; // the folder name is the part that comes right after the voicePhotos folder
      await FileSystem.deleteAsync(folderURI); // deletes folder with the audio and picture file
      setViewedImage(null);
      setViewedAudio(null);
    } else { // only an image that needs to be deleted
      await FileSystem.deleteAsync(viewedImage); // delete the currently pulled up image
      setViewedImage(null);
    }

    if ((await FileSystem.readDirectoryAsync(parentFolderURI)).length == 0) { // if the parent folder is now empty, delete it too.
      FileSystem.deleteAsync(parentFolderURI);
    }

    __getImages(); // updates UI with changes
  }

  const __goBack = () => {
    setViewedImage(null);
    setViewedAudio(null);
  }

  const confirmDeleteDayAlert = (fileName) => {
    Alert.alert(
      'Delete',
      'Are you sure you want to permanently delete all files from ' + fileName.replaceAll('.', '/') + '?',
      [
        {
          text: 'Cancel',
          onPress: () => { console.log('canceled') } ,
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: () => {__deleteDay(fileName)},
          style: 'destructive'
        }
      ],
      {
        cancelable: true,
      },
    );
  }


  const __deleteDay = async (fileName) => {
    const parentFolderURI = FILE_DIRECTORY + fileName; // the folder name is the part that comes right after the voicePhotos folder

    const info = await FileSystem.getInfoAsync(parentFolderURI);
    if (info.exists) {
      FileSystem.deleteAsync(parentFolderURI);
    }

    __getImages(); // updates UI with changes
  }


  const scrollViewRef = useRef();
  useEffect(() => { // scrolls to place where the photo was in the list
    if (viewedImage == null) {
      scrollViewRef?.current?.scrollTo({ y: scrollYPosition, animated: false });
    }
  }, [viewedImage]);

  return (
    <GestureHandlerRootView style={styles.container}>
      {
        viewedImage ? (
          <>
            <GridImagePreview photoUri={viewedImage} audioUri={viewedAudio} goBack={__goBack} deleteImage={__deletePhoto} />
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <TouchableOpacity style={[styles.button, {
                position: 'absolute',
                top: 20,
                left: 15,
              }]} onPress={() => {
                navigation.navigate('Home');
              }}><Text style={{ color: 'black', fontSize: 24, fontWeight: 'bold' }}>Back</Text></TouchableOpacity>
              {images.length > 0 && <TouchableOpacity style={[styles.button, {
                position: 'absolute',
                top: 20,
                right: 15,
                width: 175,
              }]} onPress={__downloadFiles}><Text style={{ color: 'black', fontSize: 24, fontWeight: 'bold' }}>Download All</Text></TouchableOpacity>}
            </View>
            {images.length > 0 ?
              <View style={{ flex: 10 }}>
                <ScrollView ref={scrollViewRef} onScroll={(event) => { setScrollYPosition(event.nativeEvent.contentOffset.y); }} scrollEventThrottle={160}>
                  <View style={{ marginHorizontal: 'auto', width: '100%', flexDirection: 'row', flexWrap: 'wrap' }}>
                    {images}
                  </View>
                </ScrollView>
              </View>
              :
              <View style={{ flex: 8, justifyContent: 'center', alignItems: 'center' }}><Text style={[styles.text, { color: 'white', margin: 40 }]}>No Voice Photos have been taken.</Text></View>
            }
          </>)
      }
    </GestureHandlerRootView>
  )
}

const GridImagePreview = ({ photoUri, audioUri, goBack, deleteImage }) => {
  const [currentSound, setCurrentSound] = useState(null);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(true);
  const [playbackPercent, setPlaybackPercent] = useState(0);

  useEffect(() => {
    const backAction = () => {
      if (!isPlaybackPaused) {
        __stopPlayback();
      }

      return false; // return false so BackEvent propegates up to parent.
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [isPlaybackPaused]);

  let parts = photoUri.split('/');
  const time = parts[parts.indexOf('voicePhotos') + 2];
  parts = time.split('.');

  const timeCode = (parseInt(parts[0]) >= 12) ? "PM" : "AM";
  const hours = (parseInt(parts[0]) > 12) ? parseInt(parts[0]) - 12 : parts[0]; // converts 24 hour time to 12 hour time
  const minutes = (parts[1].length == 1) ? '0' + parts[1] : parts[1];

  const confirmAlert = () => {
    Alert.alert(
      'Delete',
      'Are you sure you want to permanently delete this photo?',
      [
        {
          text: 'Cancel',
          onPress: () => console.log('Cancel Pressed'),
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: () => { __stopPlayback(); deleteImage(); },
          style: 'destructive'
        }
      ],
      {
        cancelable: true,
      },
    );
  }

  const __togglePlayback = async () => {
    if (!currentSound) { // if there is already a sound loaded, remove it
      setCurrentSound(await Audio.Sound.createAsync( // plays audio associated with the picture
        { uri: audioUri },
        {
          shouldPlay: true,
          progressUpdateIntervalMillis: 100
        },
        onPlaybackStatusUpdate
      ));
      setIsPlaybackPaused(false);
    } else {
      if (!isPlaybackPaused) {
        await currentSound.sound.pauseAsync();
        setIsPlaybackPaused(true);
      } else {
        await currentSound.sound.playAsync();
        setIsPlaybackPaused(false);
      }
    }
  }

  const __stopPlayback = async () => {
    if (currentSound) { // if there is already a sound loaded, remove it
      await currentSound.sound.stopAsync();
      setPlaybackPercent(0);
      setCurrentSound(null);
    }
  }

  const onPlaybackStatusUpdate = (playbackStatus) => {
    if (playbackStatus.isLoaded) {
      if (playbackStatus.didJustFinish) {
        setPlaybackPercent(0);
        setCurrentSound(null);
        setIsPlaybackPaused(true);
        return;
      }

      setPlaybackPercent(playbackStatus.positionMillis / playbackStatus.playableDurationMillis * 100);
    }
  }

  const panGesture = event => {
    console.log(event.nativeEvent);
  }

  return (

    <View style={{
      flex: 1,
      width: '100%',
      height: '100%'
    }}>
      <PanGestureHandler onHandlerStateChange={panGesture}>
        <View style={styles.imageContainer}>
          <ImageBackground source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }}>
            <View style={{ alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 0, left: 0, padding: 15, borderBottomEndRadius: 20, backgroundColor: 'rgba(20, 20, 20, 0.6)' }}><Text style={[styles.text, { color: 'white' }]}>Taken at: {hours}:{minutes} {timeCode}</Text></View>
            <TouchableOpacity style={[styles.button, {
              position: 'absolute',
              top: 25,
              right: 15,
              backgroundColor: 'red',
            }]} onPress={confirmAlert}><Text style={[styles.text, { color: 'white' }]}>Delete</Text></TouchableOpacity>

            {audioUri ?
              <View style={{ width: '100%', backgroundColor: 'rgba(32, 32, 32, 0.5)', position: 'absolute', bottom: 0, flex: 1, flexDirection: 'row' }}>
                <View style={{ flex: 1, marginLeft: 15, alignItems: 'center', justifyContent: 'center' }}>
                  <TouchableOpacity
                    onPress={__togglePlayback}
                    style={{
                      width: 50,
                      height: 50,
                      margin: 10,
                      backgroundColor: 'white',
                      borderRadius: 50,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 4,
                      borderColor: 'black'
                    }}>
                    <ImageBackground source={isPlaybackPaused ? require('./assets/playIcon.png') : require('./assets/stopIcon.png')} style={{ width: '100%', height: '100%' }} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 7, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ backgroundColor: 'gray', width: '90%', height: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'black' }}>
                    <View width={playbackPercent + '%'} height={'100%'} style={{ backgroundColor: 'white' }} />
                  </View>
                </View>
              </View> : <></>
            }
          </ImageBackground>
        </View>
      </PanGestureHandler>

      <View style={styles.bottomBorder}>
        <TouchableOpacity onPress={() => { __stopPlayback(); goBack(); }} style={[styles.button, { flex: 1, alignSelf: 'center', margin: 20 }]}>
          <Text style={styles.text}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>

  );
}

const VoicePhoto = ({ uri, audio, tapEvent }) => {
  return (
    <View style={gridStyles.gridItem}>
      <TapGestureHandler onHandlerStateChange={event => tapEvent(event, uri, audio)}>
        <View>
          <ImageBackground source={{ uri: uri }} style={gridStyles.gridImage}>
            {audio ?
              <View style={{ position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.75)', borderTopRightRadius: 10, bottom: 0, left: 0 }}><Image source={require('./assets/recordIcon.png')} style={{ width: 40, height: 40 }} /></View>
              :
              <></>
            }
          </ImageBackground>
        </View>
      </TapGestureHandler>
    </View>
  );
}

const gridStyles = StyleSheet.create({
  gridTitle: {
    backgroundColor: 'white',
    width: '100%',
    borderTopEndRadius: 10,
    borderTopStartRadius: 10,
    borderBottomColor: 'gray',
    borderBottomWidth: 4,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 15,
    marginTop: 10,
    justifyContent: 'center',
  },
  gridItem: {
    flex: 1,
    minWidth: '33%',
    maxWidth: '33%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
  gridImage: {
    width: '100%',
    aspectRatio: 1,
  }
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'black'
  },
  imageContainer: {
    flex: 7,
    borderRadius: 20,
    overflow: 'hidden',
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64
  },
  zoomBarContainer: {
    flex: 1,
    position: 'absolute',
    top: '25%',
    left: 15,
    height: '50%',
    width: 5,
    backgroundColor: 'rgba(32, 32, 32, 0.5)',
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  zoomBar: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 20,
    alignSelf: 'flex-end',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    color: 'black',
    width: 80,
    height: 40,
    borderRadius: 10,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  bottomBorder: {
    flex: 1,
    backgroundColor: 'black',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  takePictureButton: {
    width: 70,
    height: 70,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: '#fff',
  },
  takePictureButtonIsTaking: {
    width: 70,
    height: 70,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'black',
    borderWidth: 6,
    borderColor: 'white',
  }
})

/**
 * Returns a number whose value is limited to the given range.
 *
 * Example: limit the output of this computation to between 0 and 255
 * (x * 255).clamp(0, 255)
 *
 * @param {Number} min The lower boundary of the output range
 * @param {Number} max The upper boundary of the output range
 * @returns A number in the range [min, max]
 * @type Number
 */
Number.prototype.clamp = function (min, max) {
  return Math.min(Math.max(this, min), max);
};

const delay = ms => new Promise(res => setTimeout(res, ms));