const { spawn } = require('child_process');
const path = require('path');

// Get custom arguments passed to the script
const args = process.argv.slice(2);

// Resolve path to the next CLI binary
const nextBin = path.resolve(__dirname, '../node_modules/next/dist/bin/next');

// Filter out MallocStackLogging warnings from stderr
const child = spawn(process.execPath, [nextBin, 'dev', ...args], {
  stdio: ['inherit', 'inherit', 'pipe'], // Inherit stdin/stdout, pipe stderr
  env: {
    ...process.env,
    // Set a safe memory limit (2GB) for Node.js to prevent swapping on 8GB machines
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=2048`.trim()
  }
});

let stderrBuffer = '';

child.stderr.on('data', (chunk) => {
  stderrBuffer += chunk.toString();
  const lines = stderrBuffer.split('\n');
  
  // Keep the last partial line in the buffer
  stderrBuffer = lines.pop() || '';
  
  for (const line of lines) {
    if (!line.includes('MallocStackLogging:')) {
      process.stderr.write(line + '\n');
    }
  }
});

// Flush any remaining stderr on exit
child.stderr.on('end', () => {
  if (stderrBuffer && !stderrBuffer.includes('MallocStackLogging:')) {
    process.stderr.write(stderrBuffer);
  }
});

child.on('close', (code) => {
  process.exit(code || 0);
});
