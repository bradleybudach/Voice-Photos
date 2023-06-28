import { useState, useEffect, useRef } from 'react';
import { GestureHandlerRootView, TapGestureHandler, State } from 'react-native-gesture-handler';
import { View, TouchableOpacity, ImageBackground, BackHandler, Text, ScrollView, Image, Alert } from 'react-native'
import { StorageAccessFramework } from 'expo-file-system';
import * as FileSystem from 'expo-file-system';
import { Audio } from "expo-av";
import * as Haptics from 'expo-haptics';
import { styles, theme, gridStyles } from './stylesheet';

//Globals:
const FILE_DIRECTORY = FileSystem.documentDirectory + "voicePhotos/";

export const FileDisplay = ({ navigation }) => {
    // UI State constants:
    const [images, setImages] = useState([]);
    const [viewedImage, setViewedImage] = useState(null);
    const [viewedAudio, setViewedAudio] = useState(null);
    const [scrollYPosition, setScrollYPosition] = useState(0);

    useEffect(() => { // back button handling
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

    useEffect(() => { // loads image on first render
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

        newArr = await Promise.all(files.map(async (dayFile) => {
            let key = 0;
            let dayDirectoryURI = FILE_DIRECTORY + dayFile + "/";

            let subFiles = await FileSystem.readDirectoryAsync(dayDirectoryURI);
            subFiles.sort((a, b) => { // sort newest to oldest
                let timeA = a.split('_');
                timeA = timeA[timeA.length - 1].split('.');
                let timeB = b.split('_');
                timeB = timeB[timeB.length - 1].split('.');

                if (Math.abs(parseInt(timeB[0]) - parseInt(timeA[0])) > 0) { // compare by hours
                    return parseInt(timeB[0]) - parseInt(timeA[0]);
                } else if (Math.abs(parseInt(timeB[1]) - parseInt(timeA[1])) > 0) { // compare by minutes
                    return parseInt(timeB[1]) - parseInt(timeA[1]);
                } else { // compare by seconds
                    return parseInt(timeB[2]) - parseInt(timeA[2]);
                }
            });

            return [<View key={++key} style={gridStyles.gridTitle}>
                <Text style={styles.text}>{dayFile.replaceAll('.', '/')}</Text>
                <TouchableOpacity style={gridStyles.downloadButton} onPress={() => { __downloadFiles(dayFile) }}>
                    <ImageBackground source={require('./assets/downloadIcon.png')} style={{ width: 30, height: 30 }} />
                </TouchableOpacity>
                <TouchableOpacity style={gridStyles.deleteButton} onPress={() => { confirmDeleteDayAlert(dayFile) }}>
                    <ImageBackground source={require('./assets/deleteIcon.png')} style={{ width: 30, height: 30 }} />
                </TouchableOpacity>
            </View>,
            await Promise.all(subFiles.map(async (file) => {
                if (file.endsWith("jpg")) {
                    const uri = (dayDirectoryURI + file);
                    return (
                        <VoicePhoto key={++key} uri={uri} tapEvent={__tapEvent} />
                    );
                } else {
                    const voicePhotoDirectory = dayDirectoryURI + file + '/'; // voice photo sub directory
                    const voicePhotos = await FileSystem.readDirectoryAsync(voicePhotoDirectory); // reads directory to get file names

                    let uri;
                    let audio;

                    voicePhotos.forEach(asset => {
                        if (asset.endsWith('jpg')) {
                            uri = voicePhotoDirectory + asset;
                        } else {
                            audio = voicePhotoDirectory + asset;
                        }
                    });


                    return (
                        <VoicePhoto key={++key} uri={uri} audio={audio} tapEvent={__tapEvent} />
                    );
                }
            }))];
        }));

        setImages(newArr);
    }

    const __downloadFiles = async (day) => {
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) { return; }

        // Gets SAF URI from response
        let externalDirURI = permissions.directoryUri;

        let localFiles = await FileSystem.readDirectoryAsync(FILE_DIRECTORY);
        localFiles.forEach(async (file) => {
            if (day != null && file != day) { // only download one of the days
                return;
            }

            let dayDirectoryURI = FILE_DIRECTORY + file + "/";

            let subFile = await FileSystem.readDirectoryAsync(dayDirectoryURI);
            subFile.forEach(async (file) => {
                if (file.endsWith("jpg")) {
                    const assetUri = (dayDirectoryURI + file);

                    let filesAlreadyExisting = await StorageAccessFramework.readDirectoryAsync(externalDirURI);
                    if (filesAlreadyExisting.filter(f => f.endsWith(file)).length == 0) { // if the file doesn't yet exist
                        try {
                            StorageAccessFramework.createFileAsync(externalDirURI, file.replace('.jpg', ''), 'image/jpeg').then(async (uri) => {
                                StorageAccessFramework.writeAsStringAsync(uri, await convertFileToB64(assetUri), { encoding: FileSystem.EncodingType.Base64 });
                            });

                        } catch (e) {
                            console.error('file creation failed');
                        }
                    } else {
                        console.log('file already exists');
                    }
                } else {
                    const voicePhotoDirectory = dayDirectoryURI + file + '/'; // voice photo sub directory
                    const voicePhotos = await FileSystem.readDirectoryAsync(voicePhotoDirectory); // reads directory to get file names

                    let photoName;
                    let audioName;
                    voicePhotos.forEach(asset => {
                        if (asset.endsWith('jpg')) {
                            photoName = asset;
                        } else {
                            audioName = asset;
                        }
                    });

                    const photoUri = voicePhotoDirectory + photoName;
                    const audioURI = voicePhotoDirectory + audioName;

                    let filesAlreadyExisting = await StorageAccessFramework.readDirectoryAsync(externalDirURI);

                    if (filesAlreadyExisting.filter(f => f.endsWith(photoName)).length == 0) { // if the file doesn't yet exist
                        try {
                            StorageAccessFramework.createFileAsync(externalDirURI, photoName, 'image/jpeg').then(async (uri) => {
                                StorageAccessFramework.writeAsStringAsync(uri, await convertFileToB64(photoUri), { encoding: FileSystem.EncodingType.Base64 });
                            });
                        } catch (e) {
                            console.error('file creation failed');
                        }
                    } else {
                        console.log('file already exists');
                    }

                    if (filesAlreadyExisting.filter(f => f.endsWith(audioName)).length == 0) {
                        try {
                            StorageAccessFramework.createFileAsync(externalDirURI, audioName, 'audio/mpeg').then(async (uri) => {
                                StorageAccessFramework.writeAsStringAsync(uri, await convertFileToB64(audioURI), { encoding: FileSystem.EncodingType.Base64 });
                            });
                        } catch (e) {
                            console.error('file creation failed');
                            return;
                        }
                    } else {
                        console.log('file already exists');
                    }
                }
            });
        });

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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); // vibration on alert

        Alert.alert(
            'Delete',
            'Are you sure you want to permanently delete all files from ' + fileName.replaceAll('.', '/') + '?',
            [
                {
                    text: 'Cancel',
                    onPress: () => { console.log('canceled') },
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    onPress: () => { __deleteDay(fileName) },
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
                            }}><Text style={{ color: theme.black, fontSize: 24, fontWeight: 'bold' }}>Back</Text></TouchableOpacity>
                            {images.length > 0 && <TouchableOpacity style={[styles.button, {
                                position: 'absolute',
                                top: 20,
                                right: 15,
                                width: 175,
                                backgroundColor: theme.gold
                            }]} onPress={() => { __downloadFiles(null) }}><Text style={{ color: theme.black, fontSize: 24, fontWeight: 'bold' }}>Download All</Text></TouchableOpacity>}
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
                            <View style={{ flex: 8, justifyContent: 'center', alignItems: 'center' }}><Text style={[styles.text, { color: theme.white, margin: 40 }]}>No Voice Photos have been taken.</Text></View>
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
    parts = time.split('_');
    parts = parts[parts.length - 1].split('.');

    const timeCode = (parseInt(parts[0]) >= 12) ? "PM" : "AM";
    const hours = (parseInt(parts[0]) > 12) ? parseInt(parts[0]) - 12 : parts[0]; // converts 24 hour time to 12 hour time
    const minutes = (parts[1].length == 1) ? '0' + parts[1] : parts[1];

    const confirmDeleteAlert = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); // vibration on alert

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
            setIsPlaybackPaused(true);
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

    return (

        <View style={{
            flex: 1,
            width: '100%',
            height: '100%'
        }}>
            <View style={styles.imageContainer}>
                <ImageBackground source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }}>
                    <View style={{ alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 0, left: 0, padding: 15, borderBottomEndRadius: 20, backgroundColor: 'rgba(20, 20, 20, 0.6)' }}><Text style={[styles.text, { color: theme.white }]}>Taken at: {hours}:{minutes} {timeCode}</Text></View>
                    <TouchableOpacity style={[styles.button, {
                        position: 'absolute',
                        top: 10,
                        right: 15,
                        backgroundColor: theme.red,
                    }]} onPress={confirmDeleteAlert}><Text style={[styles.text, { color: theme.black }]}>Delete</Text></TouchableOpacity>

                    {audioUri ?
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
            </View>

            <View style={styles.bottomBorder}>
                <TouchableOpacity onPress={() => { __stopPlayback(); goBack(); }} style={[styles.button, { flex: 1, alignSelf: 'center', margin: 20, backgroundColor: theme.white }]}>
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
                        {audio &&
                            <View style={gridStyles.audioIndicator}>
                                <Image source={require('./assets/recordIcon.png')} style={{ width: 40, height: 40 }} />
                            </View>
                        }
                    </ImageBackground>
                </View>
            </TapGestureHandler>
        </View>
    );
}