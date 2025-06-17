
// Script pour exécuter le test direct de task-recommendation-agent
const { spawn } = require('child_process');

console.log('🔄 Démarrage du test direct de task-recommendation-agent...\n');

const testProcess = spawn('node', ['test-task-recommendation-direct.js'], {
  stdio: 'inherit',
  env: process.env
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Test direct terminé avec succès');
  } else {
    console.log(`\n❌ Test direct terminé avec code d'erreur: ${code}`);
  }
});

testProcess.on('error', (error) => {
  console.error('❌ Erreur lors de l\'exécution du test direct:', error);
});
