const PRAXIS_ONTOLOGY = {
  "BODY_FITNESS": { ayuDomain: 'HEAL', unit: 'reps', contextHints: ['gym', 'workout'] },
  "CAREER_CRAFT": { ayuDomain: 'FABRICATE', unit: 'deliverables', contextHints: ['desk', 'office'] }
};

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

fs.writeFileSync(path.join(distDir, 'praxis-ontology.json'), JSON.stringify(PRAXIS_ONTOLOGY, null, 2));
console.log('Ontology exported.');
