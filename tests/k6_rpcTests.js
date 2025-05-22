import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Launch with  k6 run k6_rpcTests.js 

// Define custom metrics
const rpcCallCounter = new Counter('rpc_calls');
const rpcErrorRate = new Rate('rpc_errors');
const rpcLatency = new Trend('rpc_latency');

// Define endpoint-specific metrics
const lavaLatency = new Trend('lava_latency');
const otherLatency = new Trend('other_latency');

// Define method-specific metrics for each endpoint type
const lavaMultiGetObjects = new Trend('lava_multiGetObjects');
const lavaGetLatestCheckpoint = new Trend('lava_getLatestCheckpoint');
const lavaGetReferenceGasPrice = new Trend('lava_getReferenceGasPrice');

const otherMultiGetObjects = new Trend('other_multiGetObjects');
const otherGetLatestCheckpoint = new Trend('other_getLatestCheckpoint');
const otherGetReferenceGasPrice = new Trend('other_getReferenceGasPrice');

// Store metrics for final summary
let lavaCallCount = 0;
let otherCallCount = 0;
let lavaMethodCounts = {
  multiGetObjects: 0,
  getLatestCheckpoint: 0,
  getReferenceGasPrice: 0
};
let otherMethodCounts = {
  multiGetObjects: 0,
  getLatestCheckpoint: 0,
  getReferenceGasPrice: 0
};

// Configuration
const LAVA_ENDPOINT = "https://sui.obsuidian.xyz";
const OTHER_ENDPOINTS = [
  "https://fullnode.mainnet.sui.io:443",
  "https://sui-mainnet.nodeinfra.com",
];

// Test options
export const options = {
  scenarios: {
    constant_request_rate: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s', // 10 iterations per second
      duration: '30s',
      preAllocatedVUs: 10, // how many VUs to pre-allocate
      maxVUs: 50, // maximum number of VUs to use if needed
    },
  },
};

// Helper function to generate random SUI address
function generateRandomAddress() {
  const chars = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Test methods
const TEST_METHODS = {
  multiGetObjects: {
    method: "sui_multiGetObjects",
    params: () => [
      Array.from({ length: 5 }, () => generateRandomAddress()),
      { showContent: true, showType: true, showDisplay: true }
    ]
  },
  getLatestCheckpoint: {
    method: "sui_getLatestCheckpointSequenceNumber",
    params: () => []
  },
  getReferenceGasPrice: {
    method: "suix_getReferenceGasPrice",
    params: () => []
  }
};

// Main test function
export default function() {
  // Alternate between Lava and other endpoints to ensure balanced testing
  const useOtherEndpoint = __ITER % 2 === 0;
  
  let endpoint;
  if (useOtherEndpoint) {
    // Select a random endpoint from OTHER_ENDPOINTS
    endpoint = OTHER_ENDPOINTS[Math.floor(Math.random() * OTHER_ENDPOINTS.length)];
    otherCallCount++;
  } else {
    endpoint = LAVA_ENDPOINT;
    lavaCallCount++;
  }
  
  // Cycle through methods to ensure balanced testing
  const methodNames = Object.keys(TEST_METHODS);
  const methodName = methodNames[__ITER % methodNames.length];
  const testMethod = TEST_METHODS[methodName];
  
  // Track method counts
  if (endpoint === LAVA_ENDPOINT) {
    lavaMethodCounts[methodName]++;
  } else {
    otherMethodCounts[methodName]++;
  }
  
  // Prepare the JSON-RPC request
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: testMethod.method,
    params: testMethod.params()
  });
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Send the request and measure time
  const response = http.post(endpoint, payload, { headers });
  
  // Record metrics
  rpcCallCounter.add(1);
  rpcLatency.add(response.timings.duration);
  
  // Record endpoint-specific metrics
  if (endpoint === LAVA_ENDPOINT) {
    lavaLatency.add(response.timings.duration);
    
    // Record method-specific metrics for Lava
    switch(methodName) {
      case 'multiGetObjects':
        lavaMultiGetObjects.add(response.timings.duration);
        break;
      case 'getLatestCheckpoint':
        lavaGetLatestCheckpoint.add(response.timings.duration);
        break;
      case 'getReferenceGasPrice':
        lavaGetReferenceGasPrice.add(response.timings.duration);
        break;
    }
  } else {
    otherLatency.add(response.timings.duration);
    
    // Record method-specific metrics for other endpoints
    switch(methodName) {
      case 'multiGetObjects':
        otherMultiGetObjects.add(response.timings.duration);
        break;
      case 'getLatestCheckpoint':
        otherGetLatestCheckpoint.add(response.timings.duration);
        break;
      case 'getReferenceGasPrice':
        otherGetReferenceGasPrice.add(response.timings.duration);
        break;
    }
  }
  
  // Check if the request was successful
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'no error in response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.error === undefined;
      } catch (e) {
        return false;
      }
    }
  });
  
  if (!success) {
    rpcErrorRate.add(1);
    console.log(`Error calling ${testMethod.method} on ${endpoint}: ${response.status} ${response.body}`);
  }
  
  // Add a small sleep to avoid overwhelming the RPC
  sleep(0.1);
}

// Helper function to calculate percentage difference
function calculateOverhead(lavaValue, otherValue) {
  if (!lavaValue || !otherValue) return "N/A";
  return ((lavaValue - otherValue) / otherValue * 100).toFixed(2);
}
// ... (keep all the previous code up to handleSummary the same) ...

// This function will be called at the end of the test
export function handleSummary(data) {
  console.log("\nSUI RPC PERFORMANCE TEST RESULTS");
  console.log("=================================");
  
  // Overall statistics
  console.log("\n📊 OVERALL STATISTICS:");
  console.log(`Total RPC Calls: ${data.metrics.rpc_calls ? data.metrics.rpc_calls.values.count : 0}`);
  console.log(`Error Rate: ${data.metrics.rpc_errors ? (data.metrics.rpc_errors.values.rate * 100).toFixed(2) : 0}%`);
  
  // Latency statistics
  console.log("\n⏱️ LATENCY STATISTICS (ms):");
  if (data.metrics.rpc_latency) {
    console.log(`Min: ${data.metrics.rpc_latency.values.min.toFixed(2)}`);
    console.log(`Max: ${data.metrics.rpc_latency.values.max.toFixed(2)}`);
    console.log(`Avg: ${data.metrics.rpc_latency.values.avg.toFixed(2)}`);
    console.log(`Med: ${data.metrics.rpc_latency.values.med.toFixed(2)}`);
  }
  
  // Lava vs Other comparison
  console.log("\n🔄 LAVA VS OTHER RPCS COMPARISON:");
  
  const lavaMetrics = data.metrics.lava_latency ? data.metrics.lava_latency.values : null;
  const otherMetrics = data.metrics.other_latency ? data.metrics.other_latency.values : null;
  
  if (lavaMetrics && otherMetrics) {
    const overallOverhead = ((lavaMetrics.avg - otherMetrics.avg) / otherMetrics.avg * 100).toFixed(2);
    
    console.log("\n📈 OVERALL PERFORMANCE:");
    console.log(`Lava RPC:`);
    console.log(`  Avg: ${lavaMetrics.avg.toFixed(2)}ms`);
    console.log(`  Min: ${lavaMetrics.min.toFixed(2)}ms`);
    console.log(`  Max: ${lavaMetrics.max.toFixed(2)}ms`);
    console.log(`  Med: ${lavaMetrics.med.toFixed(2)}ms`);
    
    console.log(`Other RPCs:`);
    console.log(`  Avg: ${otherMetrics.avg.toFixed(2)}ms`);
    console.log(`  Min: ${otherMetrics.min.toFixed(2)}ms`);
    console.log(`  Max: ${otherMetrics.max.toFixed(2)}ms`);
    console.log(`  Med: ${otherMetrics.med.toFixed(2)}ms`);
    
    console.log(`Overhead: ${overallOverhead}% ${Number(overallOverhead) > 0 ? '(Lava is slower)' : '(Lava is faster)'}`);
    
    // Method-by-method comparison
    console.log("\nMethod-by-Method Comparison:");
    
    // multiGetObjects
    const lavaMulti = data.metrics.lava_multiGetObjects ? data.metrics.lava_multiGetObjects.values : null;
    const otherMulti = data.metrics.other_multiGetObjects ? data.metrics.other_multiGetObjects.values : null;
    if (lavaMulti && otherMulti) {
      const overhead = ((lavaMulti.avg - otherMulti.avg) / otherMulti.avg * 100).toFixed(2);
      console.log(`\nmultiGetObjects:`);
      console.log(`  Lava: ${lavaMulti.avg.toFixed(2)}ms avg`);
      console.log(`  Others: ${otherMulti.avg.toFixed(2)}ms avg`);
      console.log(`  Overhead: ${overhead}% ${Number(overhead) > 0 ? '(slower)' : '(faster)'}`);
    }
    
    // getLatestCheckpoint
    const lavaCheckpoint = data.metrics.lava_getLatestCheckpoint ? data.metrics.lava_getLatestCheckpoint.values : null;
    const otherCheckpoint = data.metrics.other_getLatestCheckpoint ? data.metrics.other_getLatestCheckpoint.values : null;
    if (lavaCheckpoint && otherCheckpoint) {
      const overhead = ((lavaCheckpoint.avg - otherCheckpoint.avg) / otherCheckpoint.avg * 100).toFixed(2);
      console.log(`\ngetLatestCheckpoint:`);
      console.log(`  Lava: ${lavaCheckpoint.avg.toFixed(2)}ms avg`);
      console.log(`  Others: ${otherCheckpoint.avg.toFixed(2)}ms avg`);
      console.log(`  Overhead: ${overhead}% ${Number(overhead) > 0 ? '(slower)' : '(faster)'}`);
    }
    
    // getReferenceGasPrice
    const lavaGasPrice = data.metrics.lava_getReferenceGasPrice ? data.metrics.lava_getReferenceGasPrice.values : null;
    const otherGasPrice = data.metrics.other_getReferenceGasPrice ? data.metrics.other_getReferenceGasPrice.values : null;
    if (lavaGasPrice && otherGasPrice) {
      const overhead = ((lavaGasPrice.avg - otherGasPrice.avg) / otherGasPrice.avg * 100).toFixed(2);
      console.log(`\ngetReferenceGasPrice:`);
      console.log(`  Lava: ${lavaGasPrice.avg.toFixed(2)}ms avg`);
      console.log(`  Others: ${otherGasPrice.avg.toFixed(2)}ms avg`);
      console.log(`  Overhead: ${overhead}% ${Number(overhead) > 0 ? '(slower)' : '(faster)'}`);
    }
    
  } else {
    console.log("  Insufficient data for comparison");
  }
  
  console.log("\n=================================");
  console.log("Test completed successfully.");
  
  return {};
}
