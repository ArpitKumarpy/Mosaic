const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaymentProcessor", function () {
  let paymentProcessor;
  let owner;
  let feeRecipient;
  let seller;
  let buyer;
  
  // Test constants
  const initialFeePercentage = 250; // 2.5%
  const paymentAmount = ethers.parseEther("1.0");
  
  beforeEach(async function () {
    // Get signers
    [owner, feeRecipient, seller, buyer] = await ethers.getSigners();
    
    // Deploy the contract
    const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");
    paymentProcessor = await PaymentProcessor.deploy(initialFeePercentage, feeRecipient.address);
    await paymentProcessor.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await paymentProcessor.owner()).to.equal(owner.address);
    });

    it("Should set the initial fee percentage correctly", async function () {
      expect(await paymentProcessor.getFeePercentage()).to.equal(initialFeePercentage);
    });

    it("Should set the fee recipient correctly", async function () {
      expect(await paymentProcessor.getFeeRecipient()).to.equal(feeRecipient.address);
    });
  });

  describe("Fee Management", function () {
    it("Should allow owner to update fee percentage", async function () {
      const newFeePercentage = 300; // 3%
      
      await expect(paymentProcessor.setFeePercentage(newFeePercentage))
        .to.emit(paymentProcessor, "FeePercentageUpdated")
        .withArgs(initialFeePercentage, newFeePercentage);
      
      expect(await paymentProcessor.getFeePercentage()).to.equal(newFeePercentage);
    });

    it("Should not allow setting fee percentage above 30%", async function () {
      await expect(paymentProcessor.setFeePercentage(3100)).to.be.revertedWith("Fee percentage too high");
    });

    it("Should not allow non-owner to update fee percentage", async function () {
      await expect(
        paymentProcessor.connect(buyer).setFeePercentage(300)
      ).to.be.revertedWithCustomError(paymentProcessor, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to update fee recipient", async function () {
      const newRecipient = buyer.address;
      
      await expect(paymentProcessor.setFeeRecipient(newRecipient))
        .to.emit(paymentProcessor, "FeeRecipientUpdated")
        .withArgs(feeRecipient.address, newRecipient);
      
      expect(await paymentProcessor.getFeeRecipient()).to.equal(newRecipient);
    });

    it("Should not allow setting zero address as fee recipient", async function () {
      await expect(
        paymentProcessor.setFeeRecipient(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee recipient");
    });

    it("Should not allow non-owner to update fee recipient", async function () {
      await expect(
        paymentProcessor.connect(buyer).setFeeRecipient(buyer.address)
      ).to.be.revertedWithCustomError(paymentProcessor, "OwnableUnauthorizedAccount");
    });
  });

  describe("Payment Processing", function () {
    it("Should process payment with correct fee split", async function () {
      // Calculate expected values
      const expectedFee = paymentAmount * BigInt(initialFeePercentage) / BigInt(10000);
      const expectedSellerAmount = paymentAmount - expectedFee;
      
      // Check balances before transaction
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const feeRecipientBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);
      
      // Process payment
      await expect(
        paymentProcessor.connect(buyer).processPayment(
          seller.address,
          paymentAmount,
          { value: paymentAmount }
        )
      ).to.emit(paymentProcessor, "PaymentProcessed")
        .withArgs(buyer.address, seller.address, paymentAmount, expectedFee);
      
      // Check balances after transaction
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      const feeRecipientBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);
      
      // Verify amounts
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(expectedSellerAmount);
      expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(expectedFee);
    });

    it("Should refund excess payment", async function () {
      // Send double the required amount
      const paymentValue = paymentAmount * BigInt(2);
      
      // Calculate expected fee
      const expectedFee = paymentAmount * BigInt(initialFeePercentage) / BigInt(10000);
      const expectedSellerAmount = paymentAmount - expectedFee;
      
      // Get balances before
      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const feeRecipientBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);
      
      // Process payment and get transaction details
      const tx = await paymentProcessor.connect(buyer).processPayment(
        seller.address,
        paymentAmount,
        { value: paymentValue }
      );
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      // Get balances after
      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      const feeRecipientBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);
      
      // Verify all balances
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(expectedSellerAmount);
      expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(expectedFee);
      
      // Actual buyer spent should be payment amount + gas (not 2x payment)
      expect(buyerBalanceBefore - buyerBalanceAfter - gasUsed).to.equal(paymentAmount);
    });

    it("Should fail when payment is insufficient", async function () {
      // Send less than required amount
      const insufficientAmount = paymentAmount / BigInt(2);
      
      await expect(
        paymentProcessor.connect(buyer).processPayment(
          seller.address,
          paymentAmount,
          { value: insufficientAmount }
        )
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should work with zero fee", async function () {
      // Set fee to zero
      await paymentProcessor.setFeePercentage(0);
      
      // Get balances before
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      
      // Process payment
      await paymentProcessor.connect(buyer).processPayment(
        seller.address,
        paymentAmount,
        { value: paymentAmount }
      );
      
      // Get balance after
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      
      // Seller should receive the full amount
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(paymentAmount);
    });
  });
});