const MyAccessControl= artifacts.require("AccessControl");
const PaymentProcessor = artifacts.require("PaymentProcessor");
const ContentRegistry = artifacts.require("ContentRegistry");

module.exports = async function (deployer, network, accounts) {
  // Default platform fee is 2.5% (250 basis points)
  const platformFeePercentage = 250;
  // Fee recipient is the deployer account
  const feeRecipient = accounts[0];
  
  // Deploy access control contract
  await deployer.deploy(AccessControl);
  const MyAccessControl= await AccessControl.deployed();
  
  // Deploy payment processor contract
  await deployer.deploy(PaymentProcessor, platformFeePercentage, feeRecipient);
  const paymentProcessor = await PaymentProcessor.deployed();
  
  // Deploy content registry contract
  await deployer.deploy(ContentRegistry, accessControl.address, paymentProcessor.address);
  const contentRegistry = await ContentRegistry.deployed();
  
  console.log("MyAccessControldeployed at:", accessControl.address);
  console.log("PaymentProcessor deployed at:", paymentProcessor.address);
  console.log("ContentRegistry deployed at:", contentRegistry.address);
};