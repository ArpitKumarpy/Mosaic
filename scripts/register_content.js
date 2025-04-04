/**
 * Script to register content on the blockchain
 * 
 * Usage:
 * npx hardhat run scripts/register_content.js --network localhost -- 
 *   --file="path/to/file" 
 *   --type="IMAGE|VIDEO|AUDIO|TEXT" 
 *   --price="0.1" 
 *   --ai-training=true|false
 *   --title="Content Title" 
 *   --description="Content Description"
 */

const { ethers } = require("hardhat");
const fs = require('fs');
const { create } = require('ipfs-http-client');
const mime = require('mime-types');

// Connect to local IPFS daemon
const ipfs = create({ host: 'localhost', port: '5001', protocol: 'http' });

async function main() {
  try {
    const args = processArgs();
    if (!args.file || !args.type) {
      console.error("❌ Missing required arguments: --file and --type are required");
      process.exit(1);
    }

    const contentTypeMap = {
      "IMAGE": 0,
      "VIDEO": 1,
      "AUDIO": 2,
      "TEXT": 3
    };

    const contentTypeKey = args.type.toUpperCase();
    if (!Object.keys(contentTypeMap).includes(contentTypeKey)) {
      console.error(`❌ Invalid content type: '${args.type}'. Must be one of: ${Object.keys(contentTypeMap).join(", ")}`);
      process.exit(1);
    }

    const contentType = contentTypeMap[contentTypeKey];
    const price = args.price ? ethers.utils.parseEther(args.price) : "0";
    const aiTraining = args["ai-training"] === "false" ? false : true;

    console.log(`
📦 Registering content:
- File: ${args.file}
- Type: ${args.type}
- Price: ${args.price ? args.price + " ETH" : "Free"}
- AI Training Allowed: ${aiTraining}
- Title: ${args.title || "N/A"}
- Description: ${args.description || "N/A"}
    `);

    const fileBuffer = fs.readFileSync(args.file);
    const mimeType = mime.lookup(args.file) || "application/octet-stream";

    // Upload file to IPFS
    console.log("📤 Uploading file to IPFS...");
    const fileUpload = await ipfs.add(fileBuffer);
    const contentHash = fileUpload.cid.toString();
    console.log(`✅ File uploaded to IPFS with hash: ${contentHash}`);

    // Create metadata
    const metadata = {
      title: args.title || "",
      description: args.description || "",
      contentType: args.type,
      mimeType: mimeType,
      fileSize: fileBuffer.length,
      timestamp: new Date().toISOString(),
      ipfsHash: contentHash
    };

    // Save metadata locally
    fs.writeFileSync("metadata.json", JSON.stringify(metadata, null, 2));

    // Upload metadata to IPFS
    console.log("📤 Uploading metadata to IPFS...");
    const metadataUpload = await ipfs.add(JSON.stringify(metadata));
    const metadataHash = metadataUpload.cid.toString();
    console.log(`✅ Metadata uploaded to IPFS with hash: ${metadataHash}`);

    // Interact with smart contract
    const [signer] = await ethers.getSigners();
    const ContentRegistry = await ethers.getContractFactory("ContentRegistry");
    const contentRegistry = await ContentRegistry.deployed();

    console.log("🔐 Registering content on blockchain...");
    const tx = await contentRegistry.registerContent(
      contentHash,
      metadataHash,
      contentType,
      price,
      aiTraining
    );

    const receipt = await tx.wait();
    const contentId = receipt.events[0].args.contentId.toString();
    console.log(`🎉 Content registered with ID: ${contentId}`);
    console.log(`📜 Transaction hash: ${tx.hash}`);

    const gatewayUrl = "https://ipfs.io/ipfs/";
    console.log(`\n🔗 Content URL: ${gatewayUrl}${contentHash}`);
    console.log(`🔗 Metadata URL: ${gatewayUrl}${metadataHash}`);

    console.log(`\n✅ To verify ownership later, run:`);
    console.log(`npx hardhat run scripts/verify_ownership.js --network localhost -- --id=${contentId}`);

  } catch (error) {
    console.error("❌ Error registering content:", error);
    process.exit(1);
  }
}

function processArgs() {
  const args = {};
  const separatorIndex = process.argv.indexOf("--");
  const processArgs = separatorIndex !== -1 ? process.argv.slice(separatorIndex + 1) : [];

  for (let i = 0; i < processArgs.length; i++) {
    const arg = processArgs[i];
    if (arg.startsWith('--')) {
      const argName = arg.slice(2).split('=')[0];
      const argValue = arg.includes('=') ? arg.split('=')[1] : processArgs[++i];
      args[argName] = argValue;
    }
  }

  return args;
}

// Execute
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
