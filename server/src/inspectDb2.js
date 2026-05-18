import mongoose from 'mongoose';
import { config } from './config.js';
import { Analysis } from './models/Analysis.js';

async function inspect() {
  await mongoose.connect(config.mongoUri);
  const analysis = await Analysis.findOne({ idea: /matcha/i }).sort({ createdAt: -1 });
  if (analysis) {
    console.log("ANALYSIS IDEA:", analysis.idea);
    console.log("REGION:", analysis.region);
    console.log("STATUS:", analysis.status);
    if (analysis.report) {
      console.log("COMPETITORS:", JSON.stringify(analysis.report.competitors, null, 2));
      console.log("MARKET ANALYSIS:", JSON.stringify(analysis.report.marketAnalysis, null, 2));
    } else {
      console.log("No report found in analysis.");
    }
  } else {
    console.log("No matching matcha analysis found.");
  }
  await mongoose.disconnect();
}

inspect().catch(console.error);
