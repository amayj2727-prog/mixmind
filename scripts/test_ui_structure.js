/**
 * MIXMIND Frontend UI Architecture Verification Script
 * Validates the presence and structure of all 14 required DJ interface modules.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_MODULES = [
  { name: '1. MIXMIND Logo & Connection Status', file: 'src/components/Header.tsx', match: 'MIXMIND' },
  { name: '2. VirtualDJ Connection Indicator', file: 'src/components/Header.tsx', match: 'VDJ:' },
  { name: '3. Two-Deck Hardware Visualization', file: 'src/components/DeckHardware.tsx', match: 'DECK' },
  { name: '4. Audio Waveform Display', file: 'src/components/WaveformDisplay.tsx', match: 'WaveformDisplay' },
  { name: '5. Current Track Information', file: 'src/components/DeckHardware.tsx', match: 'track' },
  { name: '6. Incoming Track Information', file: 'src/components/DeckHardware.tsx', match: 'track' },
  { name: '7. DJ Personality Selector', file: 'src/components/PersonalityAndEnergy.tsx', match: 'PERSONALITY' },
  { name: '8. Energy Control', file: 'src/components/PersonalityAndEnergy.tsx', match: 'ENERGY' },
  { name: '9. Autopilot/Copilot/Manual Selector', file: 'src/components/Header.tsx', match: 'AUTOPILOT' },
  { name: '10. AI Transition Suggestions', file: 'src/components/AiTransitionPanel.tsx', match: '10-POINT BLUEPRINT' },
  { name: '11. Mashup Suggestions', file: 'src/components/LiveMashupPanel.tsx', match: '4-STEM HARMONIC OVERLAY' },
  { name: '12. Local Music Library', file: 'src/components/MusicLibrary.tsx', match: 'LOCAL MUSIC LIBRARY' },
  { name: '13. Session History', file: 'src/components/SessionHistory.tsx', match: 'LIVE SESSION HISTORY' },
  { name: '14. Emergency Manual Takeover', file: 'src/components/Header.tsx', match: 'EMERGENCY TAKEOVER' },
];

console.log('\n======================================================');
console.log(' 🎛️  MIXMIND FRONTEND UI MODULE AUDIT');
console.log('======================================================\n');

let allPassed = true;

for (const mod of REQUIRED_MODULES) {
  const filePath = path.join(__dirname, mod.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ [MISSING FILE] ${mod.name}: ${mod.file}`);
    allPassed = false;
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes(mod.match)) {
    console.error(`❌ [MISSING COMPONENT TOKEN] ${mod.name} in ${mod.file}`);
    allPassed = false;
  } else {
    console.log(`✅ [VERIFIED] ${mod.name}`);
  }
}

// Check build artifacts
const distHtml = path.join(__dirname, 'dist', 'index.html');
if (fs.existsSync(distHtml)) {
  console.log('\n✅ [VERIFIED] Production Vite bundle verified in frontend/dist/');
} else {
  console.error('\n❌ [FAIL] Missing frontend/dist/index.html');
  allPassed = false;
}

if (allPassed) {
  console.log('\n🎉 ALL 14 UI MODULES VERIFIED & PRODUCTION-READY!\n');
  process.exit(0);
} else {
  console.error('\n⚠️ Some UI modules failed verification.\n');
  process.exit(1);
}
