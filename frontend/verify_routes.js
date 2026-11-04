import { render } from './dist-ssr/entry-server.js';

const routes = [
  { url: '/', title: 'Landing Page' },
  { url: '/features', title: 'Features Page' },
  { url: '/how-it-works', title: 'How It Works Page' },
  { url: '/login', title: 'Login Screen' },
  { url: '/register', title: 'Registration Screen' },
  { url: '/404', title: 'Not Found Page' },
];

console.log('====================================================');
console.log('FraudShield AI — Production Route Verification Suite');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

for (const r of routes) {
  try {
    const html = render(r.url);
    if (html && html.length > 500) {
      console.log(`[PASS] ${r.title.padEnd(25)} -> ${r.url.padEnd(16)} (${html.length.toLocaleString()} bytes HTML)`);
      passed++;
    } else {
      console.error(`[FAIL] ${r.title} (${r.url}) returned insufficient HTML (${html ? html.length : 0} bytes)`);
      failed++;
    }
  } catch (err) {
    console.error(`[FAIL] ${r.title} (${r.url}) threw error during render:`, err);
    failed++;
  }
}

console.log('\n====================================================');
console.log(`Summary: ${passed} routes PASSED, ${failed} routes FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All public routes rendered without errors!');
}

