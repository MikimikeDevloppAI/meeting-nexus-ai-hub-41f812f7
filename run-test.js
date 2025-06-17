
// Script pour exécuter le test manuel de task-recommendation-agent
const { spawn } = require('child_process');

console.log('🔄 Démarrage du test manuel de task-recommendation-agent...\n');

const testProcess = spawn('node', ['test-task-recommendation-agent.js'], {
  stdio: 'inherit',
  env: process.env
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Test terminé avec succès');
  } else {
    console.log(`\n❌ Test terminé avec code d'erreur: ${code}`);
  }
});

testProcess.on('error', (error) => {
  console.error('❌ Erreur lors de l\'exécution du test:', error);
});
