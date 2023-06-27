import { Camera, CameraType } from 'expo-camera'
import { useState, useEffect, useRef } from 'react'
import { View, TouchableOpacity, ImageBackground, BackHandler, Text, Alert } from 'react-native'
import { useIsFocused } from '@react-navigation/native';
import { PinchGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme, styles } from './stylesheet';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { writeExif } from './modules/exif-writer';
import { Audio } from "expo-av";
import * as FileSystem from 'expo-file-system';

const FILE_DIRECTORY = FileSystem.documentDirectory + "voicePhotos/";

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
                                <View style={styles.zoomBarContainer} opacity={zoomLevel > 0 ? 1 : 0}>
                                    <View style={styles.zoomBar} height={zoomLevel * 100 + "%"}></View>
                                </View>
                                <TouchableOpacity style={[styles.button, {
                                    position: 'absolute',
                                    top: 15,
                                    left: 15,
                                    width: 'auto',
                                    height: 'auto',
                                    padding: 2,
                                    backgroundColor: theme.gold
                                }]} onPress={() => {
                                    setZoomLevel(0);
                                    navigation.navigate('Files');
                                }}><ImageBackground source={require('./assets/filesIcon.png')} style={{ width: 60, height: 50 }} /></TouchableOpacity>
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
            setIsPlaybackPaused(true);
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
                                    padding: 4,
                                    backgroundColor: theme.gold,
                                    borderRadius: 50,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}>
                                <ImageBackground source={isPlaybackPaused ? require('./assets/playIcon.png') : require('./assets/stopIcon.png')} style={{ width: '100%', height: '100%' }} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flex: 7, alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ backgroundColor: theme.white, width: '90%', height: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: theme.gray }}>
                                <View width={playbackPercent + '%'} height={'100%'} style={{ backgroundColor: theme.gold }} />
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
                        style={[styles.button, { flex: 1, alignSelf: 'center', marginRight: 25 }]}>
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
                        backgroundColor: theme.white,
                        borderWidth: 4,
                        borderColor: theme.gray
                    }}
                ><ImageBackground source={isRecording ? require('./assets/stopIcon.png') : require('./assets/recordIcon.png')} style={{ width: '100%', height: '100%' }} /></TouchableOpacity>

                {!isRecording ?
                    <TouchableOpacity
                        onPress={() => {
                            __stopPlayback();
                            saveFiles();
                        }}
                        style={[styles.button, { flex: 1, alignSelf: 'center', marginLeft: 25, backgroundColor: theme.gold }]}>
                        <Text style={styles.text}>Save</Text>
                    </TouchableOpacity> : <></>
                }

            </View>
        </View>
    )
}

export { HomeScreen };

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