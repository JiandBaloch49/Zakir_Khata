const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
};

const files = walkSync(path.join(__dirname, 'src', 'screens'));

let filesChanged = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Regex to match: const { a, b, c } = useSomethingStore();
  const regex = /const\s+\{\s*([a-zA-Z0-9_,\s]+)\s*\}\s*=\s*(use[A-Za-z]+Store)\(\);/g;

  content = content.replace(regex, (match, varsGroup, storeName) => {
    const vars = varsGroup.split(',').map(v => v.trim()).filter(Boolean);
    const replacements = vars.map(v => {
      // Handle aliasing: e.g. "a: b"
      if (v.includes(':')) {
        const [original, alias] = v.split(':').map(s => s.trim());
        return `const ${alias} = ${storeName}(state => state.${original});`;
      }
      return `const ${v} = ${storeName}(state => state.${v});`;
    });
    return replacements.join('\n  ');
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    filesChanged++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Refactored Zustand selectors in ${filesChanged} files.`);
