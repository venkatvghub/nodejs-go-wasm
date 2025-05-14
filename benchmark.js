#!/usr/bin/env node

// Simple benchmark script for encryption performance
import crypto from 'crypto';
import { performance } from 'node:perf_hooks';
import os from 'os';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

// Sample data sizes to test (in bytes)
const dataSizes = [100, 1000, 10000];
const iterations = 10000;
const numThreads = Math.min(4, os.cpus().length); // Limit to max 4 cores

// XOR encryption (similar to WASM implementation)
function xorEncrypt(text, key) {
  const textBuf = Buffer.isBuffer(text) ? text : Buffer.from(text, 'utf8');
  const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key);
  const result = Buffer.alloc(textBuf.length);
  
  for (let i = 0; i < textBuf.length; i++) {
    result[i] = textBuf[i] ^ keyBuf[i % keyBuf.length];
  }
  
  return result.toString('base64');
}

function xorDecrypt(encryptedB64, key) {
  const encryptedBuf = Buffer.from(encryptedB64, 'base64');
  const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key);
  const result = Buffer.alloc(encryptedBuf.length);
  
  for (let i = 0; i < encryptedBuf.length; i++) {
    result[i] = encryptedBuf[i] ^ keyBuf[i % keyBuf.length];
  }
  
  // Find the actual string length (stop at first null byte)
  let actualLength = result.length;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === 0) {
      actualLength = i;
      break;
    }
  }
  
  // Return only the valid part of the decrypted string
  return result.slice(0, actualLength).toString('utf8');
}

// Node.js native AES-256-CTR implementation for comparison
function aesEncrypt(text, key) {
  const iv = Buffer.alloc(16, 0); // Using a fixed IV for benchmark comparison
  const textBuf = Buffer.isBuffer(text) ? text : Buffer.from(text, 'utf8');
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
  let encrypted = cipher.update(textBuf, null, 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function aesDecrypt(encryptedText, key) {
  const iv = Buffer.alloc(16, 0); // Using a fixed IV for benchmark comparison
  const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
  let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Helper function to generate random strings of specified length
function generateRandomString(length) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

// Create a sample User entity (simplified for benchmarking)
function createUserEntity(firstName, lastName, email) {
  return {
    id: crypto.randomUUID(),
    first_name: firstName,
    last_name: lastName,
    email: email,
    created_at: new Date()
  };
}

// Get CPU usage for all cores
function getCpuUsage() {
  const cpus = os.cpus();
  return cpus.map(cpu => {
    const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
    return {
      model: cpu.model,
      speed: cpu.speed,
      times: { ...cpu.times },
      total
    };
  });
}

// Calculate CPU usage percentage between two measurements
function calculateCpuUsage(start, end) {
  return start.map((cpu, i) => {
    const startIdle = cpu.times.idle;
    const startTotal = cpu.total;
    const endIdle = end[i].times.idle;
    const endTotal = end[i].total;
    
    // Calculate CPU usage as 100% - idle percentage
    const idleDiff = endIdle - startIdle;
    const totalDiff = endTotal - startTotal;
    const usagePercent = 100 * (1 - idleDiff / totalDiff);
    
    return {
      core: i,
      model: cpu.model,
      usage: usagePercent.toFixed(2)
    };
  });
}

// Worker thread code
if (!isMainThread) {
  const { method, data, key, iterations } = workerData;
  let count = 0;
  const startTime = performance.now();
  
  if (method === 'xorEncrypt') {
    for (let i = 0; i < iterations; i++) {
      xorEncrypt(data, key);
      count++;
    }
  } else if (method === 'xorDecrypt') {
    const encrypted = xorEncrypt(data, key);
    for (let i = 0; i < iterations; i++) {
      xorDecrypt(encrypted, key);
      count++;
    }
  } else if (method === 'aesEncrypt') {
    for (let i = 0; i < iterations; i++) {
      aesEncrypt(data, key);
      count++;
    }
  } else if (method === 'aesDecrypt') {
    const encrypted = aesEncrypt(data, key);
    for (let i = 0; i < iterations; i++) {
      aesDecrypt(encrypted, key);
      count++;
    }
  } else if (method === 'continuousXor') {
    const endTime = Date.now() + 5000; // Run for 5 seconds
    while (Date.now() < endTime) {
      xorEncrypt(data, key);
      count++;
    }
  } else if (method === 'continuousAes') {
    const endTime = Date.now() + 5000; // Run for 5 seconds
    while (Date.now() < endTime) {
      aesEncrypt(data, key);
      count++;
    }
  }
  
  const elapsedTime = performance.now() - startTime;
  
  parentPort.postMessage({
    count,
    elapsedTime,
    opsPerSec: method.startsWith('continuous') ? count / 5 : (count / elapsedTime) * 1000
  });
}

// Main benchmark function
async function runBenchmark() {
  if (!isMainThread) return;
  
  console.log('Starting encryption/decryption benchmark...');
  console.log('-------------------------------------------');
  console.log('Test environment:');
  console.log(`CPU: ${os.cpus()[0].model} (using ${numThreads} of ${os.cpus().length} cores)`);
  console.log(`OS: ${os.platform()} ${os.release()}`);
  console.log(`Node.js: ${process.version}`);
  console.log('-------------------------------------------');
  
  console.log('XOR vs AES-256-CTR Encryption Performance (Multi-threaded)');
  console.log('--------------------------------------------------------');
  console.log('Data Size | Operation | Implementation | Avg Time (ms) | Ops/sec');
  console.log('---------|-----------|---------------|--------------|--------');
  
  // Use a 32-byte key for encryption
  const key = crypto.randomBytes(32);
  
  for (const size of dataSizes) {
    const testData = generateRandomString(size);
    
    // XOR Encryption Benchmark (parallel)
    const xorEncryptResults = await runParallelBenchmark('xorEncrypt', testData, key, iterations);
    const xorEncryptTime = xorEncryptResults.avgTime;
    const xorEncryptOps = xorEncryptResults.totalOpsPerSec;
    
    // XOR Decryption Benchmark (parallel)
    const xorDecryptResults = await runParallelBenchmark('xorDecrypt', testData, key, iterations);
    const xorDecryptTime = xorDecryptResults.avgTime;
    const xorDecryptOps = xorDecryptResults.totalOpsPerSec;
    
    // AES Encryption Benchmark (parallel)
    const aesEncryptResults = await runParallelBenchmark('aesEncrypt', testData, key, iterations);
    const aesEncryptTime = aesEncryptResults.avgTime;
    const aesEncryptOps = aesEncryptResults.totalOpsPerSec;
    
    // AES Decryption Benchmark (parallel)
    const aesDecryptResults = await runParallelBenchmark('aesDecrypt', testData, key, iterations);
    const aesDecryptTime = aesDecryptResults.avgTime;
    const aesDecryptOps = aesDecryptResults.totalOpsPerSec;
    
    // Output results
    console.log(`${size.toString().padEnd(9)} | Encrypt   | XOR            | ${xorEncryptTime.toFixed(4).padStart(12)} | ${Math.round(xorEncryptOps).toString().padStart(6)}`);
    console.log(`${size.toString().padEnd(9)} | Encrypt   | AES-256-CTR    | ${aesEncryptTime.toFixed(4).padStart(12)} | ${Math.round(aesEncryptOps).toString().padStart(6)}`);
    console.log(`${size.toString().padEnd(9)} | Decrypt   | XOR            | ${xorDecryptTime.toFixed(4).padStart(12)} | ${Math.round(xorDecryptOps).toString().padStart(6)}`);
    console.log(`${size.toString().padEnd(9)} | Decrypt   | AES-256-CTR    | ${aesDecryptTime.toFixed(4).padStart(12)} | ${Math.round(aesDecryptOps).toString().padStart(6)}`);
    console.log('---------|-----------|---------------|--------------|--------');
    
    // Calculate performance ratio
    const encryptRatio = aesEncryptTime / xorEncryptTime;
    const decryptRatio = aesDecryptTime / xorDecryptTime;
    
    console.log(`${size.toString().padEnd(9)} | Encrypt Ratio: ${encryptRatio > 1 ? 'XOR is ' + encryptRatio.toFixed(2) + 'x faster' : 'AES is ' + (1/encryptRatio).toFixed(2) + 'x faster'}`);
    console.log(`${size.toString().padEnd(9)} | Decrypt Ratio: ${decryptRatio > 1 ? 'XOR is ' + decryptRatio.toFixed(2) + 'x faster' : 'AES is ' + (1/decryptRatio).toFixed(2) + 'x faster'}`);
    console.log('');
  }
  
  // CPU Usage Measurement
  console.log('CPU Usage Measurement');
  console.log('---------------------');
  console.log(`Running 5-second CPU usage test with 1000 byte data using ${numThreads} cores...`);
  
  const testData = generateRandomString(1000);
  
  // Get baseline CPU usage
  const cpuStart = getCpuUsage();
  
  // XOR encryption CPU test (continuous for 5 seconds)
  console.log('Testing XOR encryption CPU usage...');
  const xorContinuousResults = await runParallelContinuous('continuousXor', testData, key);
  
  // Get CPU usage after XOR test
  const cpuAfterXor = getCpuUsage();
  const xorCpuUsage = calculateCpuUsage(cpuStart, cpuAfterXor);
  
  // AES encryption CPU test (continuous for 5 seconds)
  console.log('Testing AES-256-CTR encryption CPU usage...');
  const aesContinuousResults = await runParallelContinuous('continuousAes', testData, key);
  
  // Get CPU usage after AES test
  const cpuAfterAes = getCpuUsage();
  const aesCpuUsage = calculateCpuUsage(cpuAfterXor, cpuAfterAes);
  
  // Output CPU usage results
  console.log('');
  console.log(`CPU Usage Results (5-second test with 1000 byte data using ${numThreads} cores):`);
  console.log('------------------------------------------------');
  console.log(`XOR Encryption: ${xorContinuousResults.totalCount} operations`);
  console.log(`AES-256-CTR Encryption: ${aesContinuousResults.totalCount} operations`);
  console.log(`Operations ratio: XOR is ${(xorContinuousResults.totalCount / aesContinuousResults.totalCount).toFixed(2)}x faster`);
  
  // Per-core CPU usage for XOR
  console.log('\nXOR Encryption CPU Usage by Core:');
  xorCpuUsage.forEach(core => {
    console.log(`Core ${core.core}: ${core.usage}%`);
  });
  
  // Per-core CPU usage for AES
  console.log('\nAES-256-CTR Encryption CPU Usage by Core:');
  aesCpuUsage.forEach(core => {
    console.log(`Core ${core.core}: ${core.usage}%`);
  });
  
  // Calculate average CPU usage
  const avgXorCpuUsage = xorCpuUsage.reduce((sum, core) => sum + parseFloat(core.usage), 0) / xorCpuUsage.length;
  const avgAesCpuUsage = aesCpuUsage.reduce((sum, core) => sum + parseFloat(core.usage), 0) / aesCpuUsage.length;
  
  console.log(`\nAverage CPU Usage: XOR: ${avgXorCpuUsage.toFixed(2)}%, AES-256-CTR: ${avgAesCpuUsage.toFixed(2)}%`);
  console.log(`CPU Efficiency (ops/CPU%): XOR: ${(xorContinuousResults.totalCount / avgXorCpuUsage).toFixed(2)}, AES-256-CTR: ${(aesContinuousResults.totalCount / avgAesCpuUsage).toFixed(2)}`);
  
  // Verify decryption correctness
  console.log('\nDecryption Verification Test');
  console.log('---------------------------');
  
  const testStrings = [
    'Hello World',
    'This is a test string with special chars: !@#$%^&*()',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    '1234567890',
    generateRandomString(100)
  ];
  
  let allPassed = true;
  
  for (const testStr of testStrings) {
    // Test XOR encryption/decryption
    const xorEncrypted = xorEncrypt(testStr, key);
    const xorDecrypted = xorDecrypt(xorEncrypted, key);
    const xorMatches = testStr === xorDecrypted;
    
    if (!xorMatches) {
      console.log(`XOR FAIL: "${testStr}" -> "${xorDecrypted}"`);
      allPassed = false;
    }
    
    // Test AES encryption/decryption
    const aesEncrypted = aesEncrypt(testStr, key);
    const aesDecrypted = aesDecrypt(aesEncrypted, key);
    const aesMatches = testStr === aesDecrypted;
    
    if (!aesMatches) {
      console.log(`AES FAIL: "${testStr}" -> "${aesDecrypted}"`);
      allPassed = false;
    }
  }
  
  if (allPassed) {
    console.log('All decryption tests passed! Both XOR and AES correctly decrypt all test strings.');
  }
  
  // Entity simulation
  console.log('\nEntity Creation and Encryption Test');
  console.log('----------------------------------');
  
  // Create a batch of 100 user entities and encrypt their fields
  console.log('Creating and encrypting 100 user entities...');
  const startEntityTime = performance.now();
  
  const users = [];
  for (let i = 0; i < 100; i++) {
    const firstName = generateRandomString(20);
    const lastName = generateRandomString(20);
    const email = `${generateRandomString(10)}@example.com`;
    
    const user = createUserEntity(firstName, lastName, email);
    
    // Encrypt fields
    user.first_name_encrypted = xorEncrypt(user.first_name, key);
    user.last_name_encrypted = xorEncrypt(user.last_name, key);
    user.email_encrypted = xorEncrypt(user.email, key);
    
    users.push(user);
  }
  
  const entityTime = performance.now() - startEntityTime;
  console.log(`Created and encrypted 100 user entities in ${entityTime.toFixed(2)}ms (${(entityTime / 100).toFixed(2)}ms per user)`);
  
  // Test decryption of entity fields
  console.log('\nVerifying entity field decryption...');
  const testUser = users[0];
  const decryptedFirstName = xorDecrypt(testUser.first_name_encrypted, key);
  const decryptedLastName = xorDecrypt(testUser.last_name_encrypted, key);
  const decryptedEmail = xorDecrypt(testUser.email_encrypted, key);
  
  console.log('Sample user field decryption:');
  console.log(`First Name: ${testUser.first_name === decryptedFirstName ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  console.log(`Last Name: ${testUser.last_name === decryptedLastName ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  console.log(`Email: ${testUser.email === decryptedEmail ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  
  console.log('');
  console.log('Benchmark complete.');
}

// Helper function to run benchmark in parallel workers
async function runParallelBenchmark(method, data, key, totalIterations) {
  // Distribute iterations across threads
  const iterationsPerThread = Math.floor(totalIterations / numThreads);
  const promises = [];
  
  for (let i = 0; i < numThreads; i++) {
    promises.push(
      new Promise((resolve) => {
        const worker = new Worker(new URL(import.meta.url), {
          workerData: {
            method,
            data,
            key,
            iterations: iterationsPerThread
          }
        });
        
        worker.on('message', resolve);
      })
    );
  }
  
  const results = await Promise.all(promises);
  
  // Calculate aggregated metrics
  const totalCount = results.reduce((sum, r) => sum + r.count, 0);
  const totalTime = results.reduce((sum, r) => sum + r.elapsedTime, 0);
  const avgTime = totalTime / (numThreads * iterationsPerThread);
  const totalOpsPerSec = results.reduce((sum, r) => sum + r.opsPerSec, 0);
  
  return {
    totalCount,
    avgTime,
    totalOpsPerSec
  };
}

// Helper function to run continuous benchmark for CPU usage measurement
async function runParallelContinuous(method, data, key) {
  const promises = [];
  
  for (let i = 0; i < numThreads; i++) {
    promises.push(
      new Promise((resolve) => {
        const worker = new Worker(new URL(import.meta.url), {
          workerData: {
            method,
            data,
            key,
            iterations: 0 // Not used for continuous benchmarks
          }
        });
        
        worker.on('message', resolve);
      })
    );
  }
  
  const results = await Promise.all(promises);
  
  // Calculate aggregated metrics
  const totalCount = results.reduce((sum, r) => sum + r.count, 0);
  const totalOpsPerSec = results.reduce((sum, r) => sum + r.opsPerSec, 0);
  
  return {
    totalCount,
    totalOpsPerSec
  };
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
