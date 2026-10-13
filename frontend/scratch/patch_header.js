const fs = require('fs');
const path = 'C:\\Users\\User\\.gradle\\caches\\9.3.1\\transforms\\63665759bc44fa5b83dd6b6c18b77145\\workspace\\transformed\\react-android-0.86.3-debug\\prefab\\modules\\reactnative\\include\\react\\renderer\\core\\graphicsConversions.h';

if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  if (content.includes('std::format("{}%", dimension.value)')) {
    content = content.replace('std::format("{}%", dimension.value)', 'std::to_string(dimension.value) + "%"');
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully patched graphicsConversions.h in gradle cache!');
  } else {
    console.log('Pattern not found or already patched. Current lines:');
    const lines = content.split('\n');
    for (let i = 65; i < 78; i++) {
      console.log(`${i+1}: ${lines[i]}`);
    }
  }
} else {
  console.error('File does not exist:', path);
}
