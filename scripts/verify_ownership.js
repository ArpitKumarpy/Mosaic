/**
 * Script to verify content ownership on the blockchain
 * 
 * Usage:
 * npx hardhat run scripts/verify_ownership.js --network localhost -- 
 *   --id="1" 
 *   --address="0x..." (optional, defaults to current account)
 */
const { ethers } = require("hardhat");

async function main() {
  try {
    // Parse command-line arguments
    const args = processArgs();
    
    if (!args.id) {
      console.error("Missing required argument: --id");
      process.exit(1);
    }
    
    const contentId = args.id;
    
    // Get contracts
    const [defaultSigner] = await ethers.getSigners();
    const ownerAddress = args.address || await defaultSigner.getAddress();
    
    const ContentRegistry = await ethers.getContractFactory("ContentRegistry");
    const contentRegistry = await ContentRegistry.deployed();
    
    const contentTokenAddress = await contentRegistry.contentToken();
    const ContentToken = await ethers.getContractFactory("ContentToken");
    const contentToken = await ContentToken.attach(contentTokenAddress);
    
    console.log(`Verifying ownership of content ID: ${contentId}`);
    console.log(`Checking if address ${ownerAddress} is the owner...`);
    
    // Get content details
    const content = await contentRegistry.getContent(contentId);
    console.log(`\nContent Details:`);
    console.log(`- Content Hash: ${content.contentHash}`);
    console.log(`- Metadata Hash: ${content.metadataHash}`);
    console.log(`- Content Type: ${getContentTypeName(content.contentType)}`);
    console.log(`- Price: ${ethers.utils.formatEther(content.price)} ETH`);
    console.log(`- AI Training Allowed: ${content.aiTrainingAllowed}`);
    console.log(`- Registration Time: ${new Date(content.registrationTime * 1000).toLocaleString()}`);
    
    // Check token ownership
    const tokenOwner = await contentToken.ownerOf(contentId);
    const isOwner = tokenOwner.toLowerCase() === ownerAddress.toLowerCase();
    
    console.log(`\nOwnership Verification:`);
    console.log(`- Current Token Owner: ${tokenOwner}`);
    
    if (isOwner) {
      console.log("\n✅ VERIFICATION SUCCESSFUL: Address is the owner of this content");
    } else {
      console.log("\n❌ VERIFICATION FAILED: Address is NOT the owner of this content");
    }
    
    // Get token URI and metadata
    const tokenURI = await contentToken.tokenURI(contentId);
    console.log(`\nToken URI: ${tokenURI}`);
    console.log(`IPFS Gateway URL: https://ipfs.io/ipfs/${content.metadataHash}`);
    
  } catch (error) {
    console.error("Error verifying ownership:", error);
    process.exit(1);
  }
}

/**
 * Convert content type number to name
 */
function getContentTypeName(typeNumber) {
  const types = ["IMAGE", "VIDEO", "AUDIO", "TEXT"];
  return typeNumber < types.length ? types[typeNumber] : "UNKNOWN";
}

/**
 * Process command line arguments
 * @returns {Object} Parsed arguments
 */
function processArgs() {
  const args = {};
  // Find the index of the "--" separator
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

// Hardhat script execution pattern
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });