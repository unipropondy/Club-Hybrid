const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '../print-bridge/customer-display-web/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Remove any existing style tags for fonts
html = html.replace(/<style id="vector-icons-fonts">[\s\S]*?<\/style>/g, '');

const fontStyles = `
    <style id="vector-icons-fonts">
      /* Ionicons (used both as Ionicons and ionicons) */
      @font-face {
        font-family: 'ionicons';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf') format('truetype');
      }
      @font-face {
        font-family: 'Ionicons';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf') format('truetype');
      }

      /* Material Community Icons */
      @font-face {
        font-family: 'material-community';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.6e435534bd35da5fef04168860a9b8fa.ttf') format('truetype');
      }
      @font-face {
        font-family: 'MaterialCommunityIcons';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.6e435534bd35da5fef04168860a9b8fa.ttf') format('truetype');
      }

      /* Material Icons */
      @font-face {
        font-family: 'material';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.4e85bc9ebe07e0340c9c4fc2f6c38908.ttf') format('truetype');
      }
      @font-face {
        font-family: 'MaterialIcons';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.4e85bc9ebe07e0340c9c4fc2f6c38908.ttf') format('truetype');
      }

      /* FontAwesome */
      @font-face {
        font-family: 'FontAwesome';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.b06871f281fee6b241d60582ae9369b9.ttf') format('truetype');
      }

      /* FontAwesome 5 */
      @font-face {
        font-family: 'FontAwesome5Free-Solid';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.605ed7926cf39a2ad5ec2d1f9d391d3d.ttf') format('truetype');
      }
      @font-face {
        font-family: 'FontAwesome5Free-Regular';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Regular.1f77739ca9ff2188b539c36f30ffa2be.ttf') format('truetype');
      }
      @font-face {
        font-family: 'FontAwesome5Free-Brand';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Brands.3b89dd103490708d19a95adcae52210e.ttf') format('truetype');
      }

      /* Feather */
      @font-face {
        font-family: 'feather';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ca4b48e04dc1ce10bfbddb262c8b835f.ttf') format('truetype');
      }
      @font-face {
        font-family: 'Feather';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ca4b48e04dc1ce10bfbddb262c8b835f.ttf') format('truetype');
      }

      /* Entypo */
      @font-face {
        font-family: 'entypo';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Entypo.31b5ffea3daddc69dd01a1f3d6cf63c5.ttf') format('truetype');
      }
      @font-face {
        font-family: 'Entypo';
        src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Entypo.31b5ffea3daddc69dd01a1f3d6cf63c5.ttf') format('truetype');
      }

      /* Inter font families */
      @font-face {
        font-family: 'Inter_400Regular';
        src: url('/assets/node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.51b6ad87261f18b6433ec52871ddfabc.ttf') format('truetype');
      }
      @font-face {
        font-family: 'Inter_500Medium';
        src: url('/assets/node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.137ab18bace28dd0bd83eb3b8ed2bc54.ttf') format('truetype');
      }
      @font-face {
        font-family: 'Inter_600SemiBold';
        src: url('/assets/node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.a5f35888d2da465de352e0dcfaf33324.ttf') format('truetype');
      }
      @font-face {
        font-family: 'Inter_700Bold';
        src: url('/assets/node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.6e237de4f1f413afa2fcc45c77ac343a.ttf') format('truetype');
      }
      @font-face {
        font-family: 'Inter_800ExtraBold';
        src: url('/assets/node_modules/@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.6016034293c084aa0c056e83938bf1cc.ttf') format('truetype');
      }
      @font-face {
        font-family: 'Inter_900Black';
        src: url('/assets/node_modules/@expo-google-fonts/inter/900Black/Inter_900Black.bcec6eda9700a81ba92c483a2f2c02c1.ttf') format('truetype');
      }
    </style>
`;

html = html.replace('</head>', fontStyles + '\n  </head>');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Successfully injected comprehensive font face declarations.');
