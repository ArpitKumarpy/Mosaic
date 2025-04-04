/**
 * querry_permissions.js
 * Script to query content usage permissions on the blockchain
 * 
 * Usage:
 * npx hardhat run scripts/query_permissions.js --network localhost -- 
 *   --id="1" 
 *   --address="0x..." (optional, defaults to current account)
 *   --usage="view|download|commercial|ai" (optional, defaults to all)
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
    const [defaultAccount] = await ethers.getSigners();
    const userAddress = args.address || await defaultAccount.getAddress();
    
    const ContentRegistry = await ethers.getContractFactory("ContentRegistry");
    const contentRegistry = await ContentRegistry.deployed();
    
    const accessControlAddress = await contentRegistry.accessControl();
    const AccessControl= await ethers.getContractFactory("AccessControl");
    const MyAccessControl= await AccessControl.attach(accessControlAddress);
    
    console.log(`Querying permissions for content ID: ${contentId}`);
    console.log(`Checking permissions for address: ${userAddress}`);
    
    // Get content details
    const content = await contentRegistry.getContent(contentId);
    const owner = await contentRegistry.getContentOwner(contentId);
    
    console.log(`\nContent Details:`);
    console.log(`- Content Hash: ${content.contentHash}`);
    console.log(`- Content Type: ${getContentTypeName(content.contentType)}`);
    console.log(`- Owner: ${owner}`);
    console.log(`- Price: ${ethers.utils.formatEther(content.price)} ETH`);
    
    // Check if user has purchased the content
    const hasPurchased = await accessControl.hasPurchased(contentId, userAddress);
    
    // Check permissions
    const permissions = {
      view: await checkPermission(accessControl, 'canView', contentId, userAddress, owner),
      download: await checkPermission(accessControl, 'canDownload', contentId, userAddress, owner),
      commercial: await checkPermission(accessControl, 'canUseCommercially', contentId, userAddress, owner),
      ai: content.aiTrainingAllowed
    };
    
    console.log(`\nPermission Status:`);
    console.log(`- Has Purchased: ${hasPurchased ? '✅ Yes' : '❌ No'}`);
    
    const requestedUsage = args.usage ? [args.usage] : ['view', 'download', 'commercial', 'ai'];
    
    for (const usage of requestedUsage) {
      if (permissions[usage] !== undefined) {
        console.log(`- ${formatUsageType(usage)}: ${permissions[usage] ? '✅ Allowed' : '❌ Not Allowed'}`);
      } else {
        console.log(`- ${formatUsageType(usage)}: ❓ Unknown permission type`);
      }
    }
    
    if (!hasPurchased && content.price > 0) {
      console.log(`\nTo purchase this content, use:`);
      console.log(`npx hardhat run scripts/purchase_content.js --network localhost -- --id=${contentId} --value=${ethers.utils.formatEther(content.price)}`);
    }
  } catch (error) {
    console.error("Error querying permissions:", error);
    process.exit(1);
  }
}

/**
 * Check a specific permission
 */
async function checkPermission(accessControl, method, contentId, address, owner) {
  // Owner always has permission
  if (address.toLowerCase() === owner.toLowerCase()) {
    return true;
  }
  
  // Check specific permission
  return await accessControl[method](contentId, address);
}

/**
 * Format usage type for display
 */
function formatUsageType(usage) {
  const formats = {
    'view': 'View Content',
    'download': 'Download Content',
    'commercial': 'Commercial Use',
    'ai': 'AI Training Use'
  };
  
  return formats[usage] || usage;
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