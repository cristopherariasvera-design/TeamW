const fs = require('fs-extra');
const path = require('path');

const distPath = path.join(__dirname, 'dist');
const assetsDest = path.join(distPath, 'assets');
const fontsDest = path.join(assetsDest, 'fonts');
const fontsSource = path.join(__dirname, 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts');

console.log('\n=== COPIANDO FUENTES ===');

// Crear directorios
fs.ensureDirSync(fontsDest);
const nodeModulesFontsPath = path.join(assetsDest, 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts');
fs.ensureDirSync(nodeModulesFontsPath);

// Copiar fuentes
const fontFiles = fs.readdirSync(fontsSource).filter(file => file.endsWith('.ttf'));
console.log(`✅ Encontrados ${fontFiles.length} archivos de fuentes`);

fontFiles.forEach(file => {
  const src = path.join(fontsSource, file);
  fs.copyFileSync(src, path.join(fontsDest, file));
  fs.copyFileSync(src, path.join(nodeModulesFontsPath, file));
});

console.log(`✅ Copiadas ${fontFiles.length} fuentes a ambas ubicaciones`);

// Función recursiva para encontrar archivos
function findFiles(dir, extension, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, extension, fileList);
    } else if (file.endsWith(extension)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Buscar archivos JS y CSS recursivamente
console.log('\n=== BUSCANDO ARCHIVOS CON HASH ===');

const jsFiles = findFiles(distPath, '.js');
const cssFiles = findFiles(distPath, '.css');

console.log(`📝 Archivos JS encontrados: ${jsFiles.length}`);
console.log(`📝 Archivos CSS encontrados: ${cssFiles.length}`);

if (jsFiles.length > 0) {
  console.log('📄 Primeros 3 archivos JS:');
  jsFiles.slice(0, 3).forEach(f => console.log(`   - ${path.relative(distPath, f)}`));
}

const allFiles = [...jsFiles, ...cssFiles];
const foundHashes = new Map();

// Buscar hashes en todos los archivos
allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Diferentes patrones para capturar los hashes
  const patterns = [
    /([A-Za-z0-9_-]+)\.([a-f0-9]{32})\.ttf/g,
    /"([^"]+)\.([a-f0-9]{32})\.ttf"/g,
    /'([^']+)\.([a-f0-9]{32})\.ttf'/g,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const fontName = match[1].split('/').pop(); // Obtener solo el nombre del archivo
      const hash = match[2];
      const fullName = `${fontName}.${hash}.ttf`;
      
      if (!foundHashes.has(fullName)) {
        foundHashes.set(fullName, { fontName, hash });
        console.log(`  🔎 Encontrado: ${fullName}`);
      }
    }
  });
});

console.log(`\n📊 Total archivos con hash únicos: ${foundHashes.size}`);

// Copiar con hash
if (foundHashes.size > 0) {
  console.log('\n=== COPIANDO CON HASH ===');
  
  foundHashes.forEach(({ fontName, hash }, fullName) => {
    // Buscar el archivo original (sin hash)
    const originalFile = fontFiles.find(f => {
      const baseName = f.replace('.ttf', '');
      return baseName === fontName || baseName.startsWith(fontName) || fontName.startsWith(baseName);
    });
    
    if (originalFile) {
      const src = path.join(fontsSource, originalFile);
      
      // Copiar con el nombre hasheado
      const destHash1 = path.join(fontsDest, fullName);
      const destHash2 = path.join(nodeModulesFontsPath, fullName);
      
      fs.copyFileSync(src, destHash1);
      fs.copyFileSync(src, destHash2);
      
      console.log(`  ✅ ${originalFile} → ${fullName}`);
    } else {
      console.log(`  ⚠️  No se encontró original para: ${fontName}`);
    }
  });
} else {
  console.log('\n⚠️  No se encontraron hashes. Usando solo fuentes normales.');
}

// Crear CSS
const cssContent = fontFiles.map(file => {
  const fontName = file.replace('.ttf', '');
  return `@font-face{font-family:'${fontName}';src:url('./fonts/${file}') format('truetype');font-display:swap;}`;
}).join('\n');

fs.writeFileSync(path.join(assetsDest, 'vector-icons.css'), cssContent);
console.log('\n✅ CSS creado');

// Inyectar en HTML
const indexPath = path.join(distPath, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const linkTag = '<link rel="stylesheet" href="./assets/vector-icons.css">';

if (!html.includes(linkTag)) {
  html = html.replace('</head>', `${linkTag}\n</head>`);
  fs.writeFileSync(indexPath, html);
  console.log('✅ CSS inyectado en HTML');
}

console.log('\n✨ Completado\n');