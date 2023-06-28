import { StyleSheet } from 'react-native'

const theme = {
    black: '#000000',
    white: '#FFFFFF',
    gray: 'gray',
    red: '#FF2B00',
    gold: '#F4C430'
};

const gridStyles = StyleSheet.create({
    gridTitle: {
        backgroundColor: theme.white,
        width: '100%',
        borderTopEndRadius: 10,
        borderTopStartRadius: 10,
        borderBottomColor: theme.gold,
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
    },
    downloadButton: {
        position: 'absolute',
        right: 50,
        bottom: 5,
        borderWidth: 2,
        borderColor: theme.black,
        backgroundColor: theme.gold,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center'
    },
    deleteButton: {
        position: 'absolute',
        right: 10,
        bottom: 5,
        borderWidth: 2,
        borderColor: theme.black,
        backgroundColor: theme.red,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center'
    },
    audioIndicator: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderTopRightRadius: 7,
        bottom: 0,
        left: 0
    }
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: theme.black
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
        backgroundColor: theme.white,
        color: theme.black,
        width: 80,
        height: 40,
        borderRadius: 10,
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.black
    },
    bottomBorder: {
        flex: 1,
        backgroundColor: theme.black,
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
    },
    takePictureButton: {
        width: 70,
        height: 70,
        bottom: 0,
        borderRadius: 50,
        backgroundColor: theme.white,
    },
    takePictureButtonIsTaking: {
        width: 70,
        height: 70,
        bottom: 0,
        borderRadius: 50,
        backgroundColor: theme.black,
        borderWidth: 6,
        borderColor: theme.white,
    }
});

export { theme, styles, gridStyles };