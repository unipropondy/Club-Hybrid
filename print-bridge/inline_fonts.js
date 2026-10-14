const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, 'customer-display-web/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Function to convert font file to base64 data URI
function getFontDataUri(relPath) {
  const fullPath = path.resolve(__dirname, 'customer-display-web', relPath);
  if (fs.existsSync(fullPath)) {
    const data = fs.readFileSync(fullPath).toString('base64');
    return `data:font/truetype;charset=utf-8;base64,${data}`;
  }
  return `/${relPath}`;
}

const ioniconsUri = getFontDataUri('assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf');
const matCommUri = getFontDataUri('assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.6e435534bd35da5fef04168860a9b8fa.ttf');
const matUri = getFontDataUri('assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.4e85bc9ebe07e0340c9c4fc2f6c38908.ttf');
const faUri = getFontDataUri('assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.b06871f281fee6b241d60582ae9369b9.ttf');
const fa5SolidUri = getFontDataUri('assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.605ed7926cf39a2ad5ec2d1f9d391d3d.ttf');
const fa5RegUri = getFontDataUri('assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Regular.1f77739ca9ff2188b539c36f30ffa2be.ttf');
const featherUri = getFontDataUri('assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ca4b48e04dc1ce10bfbddb262c8b835f.ttf');
const entypoUri = getFontDataUri('assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Entypo.31b5ffea3daddc69dd01a1f3d6cf63c5.ttf');

// Inter font regular & bold
const interRegUri = getFontDataUri('assets/node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.51b6ad87261f18b6433ec52871ddfabc.ttf');
const interMedUri = getFontDataUri('assets/node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.137ab18bace28dd0bd83eb3b8ed2bc54.ttf');
const interSemiUri = getFontDataUri('assets/node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.a5f35888d2da465de352e0dcfaf33324.ttf');
const interBoldUri = getFontDataUri('assets/node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.6e237de4f1f413afa2fcc45c77ac343a.ttf');
const interBlackUri = getFontDataUri('assets/node_modules/@expo-google-fonts/inter/900Black/Inter_900Black.bcec6eda9700a81ba92c483a2f2c02c1.ttf');

html = html.replace(/<style id="vector-icons-fonts">[\s\S]*?<\/style>/g, '');

const inlineFontStyles = `
    <style id="vector-icons-fonts">
      @font-face {
        font-family: 'ionicons';
        src: url('${ioniconsUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Ionicons';
        src: url('${ioniconsUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'material-community';
        src: url('${matCommUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'MaterialCommunityIcons';
        src: url('${matCommUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'material';
        src: url('${matUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'MaterialIcons';
        src: url('${matUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'FontAwesome';
        src: url('${faUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'FontAwesome5Free-Solid';
        src: url('${fa5SolidUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'FontAwesome5Free-Regular';
        src: url('${fa5RegUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'feather';
        src: url('${featherUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Feather';
        src: url('${featherUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'entypo';
        src: url('${entypoUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Entypo';
        src: url('${entypoUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Inter_400Regular';
        src: url('${interRegUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Inter_500Medium';
        src: url('${interMedUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Inter_600SemiBold';
        src: url('${interSemiUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Inter_700Bold';
        src: url('${interBoldUri}') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Inter_900Black';
        src: url('${interBlackUri}') format('truetype');
        font-display: block;
      }
    </style>
`;

html = html.replace('</head>', inlineFontStyles + '\n  </head>');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Successfully inlined base64 vector icon & Inter fonts into index.html');
