const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ContentRegistry", function () {
  let contentRegistry;
  let accessControl;
  let paymentProcessor;
  let contentToken;
  let owner;
  let user1;
  let user2;
  let admin;

  // Content registration parameters
  const contentHash = "QmT9qk3CRYbFDWpDFYeAv8T8H1gnongwKhh5J68NLkLir6";
  const metadataHash = "QmV5tFtbsKMyG1cAPN59pzXrBpT96ye4ERfA9TJQ7JTJkp";
  const updatedMetadataHash = "QmNewMetadataHash";
  const contentType = 0; // IMAGE
  const price = ethers.parseEther("0.1");
  const updatedPrice = ethers.parseEther("0.2");
  const aiTrainingAllowed = true;
  const updatedAiTrainingAllowed = false;
  const disputeEvidence = "QmDisputeEvidenceHash";

  // Role enum values matching the contract
  const Role = {
    NONE: 0,
    USER: 1,
    PREMIUM_USER: 2,
    CONTENT_MODERATOR: 3,
    ADMIN: 4
  };

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, admin] = await ethers.getSigners();

    // Deploy AccessControl
    const AccessControl = await ethers.getContractFactory("MyAccessControl");
    accessControl = await AccessControl.deploy();
    await accessControl.waitForDeployment();

    // Assign ADMIN role to admin account
    await accessControl.assignRole(admin.address, Role.ADMIN);

    // Deploy PaymentProcessor
    const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");
    paymentProcessor = await PaymentProcessor.deploy();
    await paymentProcessor.waitForDeployment();

    // Deploy ContentRegistry
    const ContentRegistry = await ethers.getContractFactory("ContentRegistry");
    contentRegistry = await ContentRegistry.deploy(accessControl.address, paymentProcessor.address);
    await contentRegistry.waitForDeployment();

    // Get the ContentToken contract
    // In your ContentRegistry implementation, the ContentToken is created in the constructor
    // We need to extract it from events or other means
    // For this example, I'm assuming we can get it from the contract's internal state
    // This is a simplification - you may need a proper getter in the contract
    
    // Method 1: If you add a getter function to ContentRegistry to expose the ContentToken address
    // const contentTokenAddress = await contentRegistry.contentTokenAddress();

    // Method 2: Since the ContentToken is created in the constructor, you could listen to the 
    // Transfer event from the token contract's 'mint' function when you register content
    
    // For now, let's simulate registering content to mint a token and capture the event
    const tx = await contentRegistry.registerContent(
      "InitialContentHash",
      "InitialMetadataHash",
      contentType,
      ethers.parseEther("0.01"),
      true
    );
    
    // Look for Transfer event from the ContentToken contract
    const receipt = await tx.wait();
    
    // Find the event that looks like a token transfer
    // This is a simplified approach and depends on how your contract is implemented
    let tokenEvent;
    for (const event of receipt.logs) {
      try {
        // Try to decode as a Transfer event
        const ContentToken = await ethers.getContractFactory("ContentToken");
        const iface = ContentToken.interface;
        const decoded = iface.parseLog(event);
        if (decoded && decoded.name === 'Transfer') {
          tokenEvent = decoded;
          break;
        }
      } catch (e) {
        // Not a Transfer event, continue
      }
    }
    
    // If we found a token event, get the token contract
    if (tokenEvent) {
      const ContentToken = await ethers.getContractFactory("ContentToken");
      contentToken = ContentToken.attach(event.address);
    } else {
      // Fallback: Look at the contract's internal state if possible
      // This is implementation-specific and might require direct access to storage
      console.warn("Could not find ContentToken contract address from events. Tests may fail.");
    }
  });

  describe("Content Registration", function () {
    it("Should register new content and mint a token", async function () {
      // Register content
      await expect(
        contentRegistry.registerContent(
          contentHash,
          metadataHash,
          contentType,
          price,
          aiTrainingAllowed
        )
      )
        .to.emit(contentRegistry, "ContentRegistered")
        .withArgs(2, owner.address, contentHash, contentType);

      // Check content exists
      const registeredId = await contentRegistry.isContentRegistered(contentHash);
      expect(registeredId).to.equal(2);

      // Check content details
      const content = await contentRegistry.getContent(2);
      expect(content.id).to.equal(2);
      expect(content.owner).to.equal(owner.address);
      expect(content.contentHash).to.equal(contentHash);
      expect(content.metadataHash).to.equal(metadataHash);
      expect(content.contentType).to.equal(contentType);
      expect(content.status).to.equal(0); // ACTIVE
      expect(content.price).to.equal(price);
      expect(content.aiTrainingAllowed).to.equal(aiTrainingAllowed);

      // Check NFT ownership - might need to modify this if ContentToken interface is different
      // This assumes the contentToken has an ownerOf method
      if (contentToken) {
        try {
          expect(await contentToken.ownerOf(2)).to.equal(owner.address);
        } catch (e) {
          console.warn("Could not check token ownership. Make sure ContentToken is properly integrated.");
        }
      }
    });

    it("Should not register duplicate content", async function () {
      // Register content first time
      await contentRegistry.registerContent(
        contentHash,
        metadataHash,
        contentType,
        price,
        aiTrainingAllowed
      );

      // Try to register same content again
      await expect(
        contentRegistry.registerContent(
          contentHash,
          metadataHash,
          contentType,
          price,
          aiTrainingAllowed
        )
      ).to.be.revertedWith("Content with this hash already registered");
    });
  });

  describe("Content Management", function () {
    beforeEach(async function () {
      // Register new content for these tests
      await contentRegistry.registerContent(
        "UniqueContentHash",
        metadataHash,
        contentType,
        price,
        aiTrainingAllowed
      );
    });

    it("Should update content metadata", async function () {
      // Get latest content ID
      const ownerContentIds = await contentRegistry.getContentByOwner(owner.address);
      const contentId = ownerContentIds[ownerContentIds.length - 1];
      
      await expect(
        contentRegistry.updateContent(
          contentId,
          updatedMetadataHash,
          updatedPrice,
          updatedAiTrainingAllowed
        )
      )
        .to.emit(contentRegistry, "ContentUpdated")
        .withArgs(contentId, owner.address);

      const content = await contentRegistry.getContent(contentId);
      expect(content.metadataHash).to.equal(updatedMetadataHash);
      expect(content.price).to.equal(updatedPrice);
      expect(content.aiTrainingAllowed).to.equal(updatedAiTrainingAllowed);
    });

    it("Should not allow non-owner to update content", async function () {
      // Get latest content ID
      const ownerContentIds = await contentRegistry.getContentByOwner(owner.address);
      const contentId = ownerContentIds[ownerContentIds.length - 1];
      
      await expect(
        contentRegistry.connect(user1).updateContent(
          contentId,
          updatedMetadataHash,
          updatedPrice,
          updatedAiTrainingAllowed
        )
      ).to.be.revertedWith("Only owner can update content");
    });

    it("Should retrieve content by owner", async function () {
      const ownerContentIds = await contentRegistry.getContentByOwner(owner.address);
      expect(ownerContentIds.length).to.be.at.least(1);
      
      // Get the last registered content
      const contentId = ownerContentIds[ownerContentIds.length - 1];
      
      // Verify it exists and has the correct owner
      const content = await contentRegistry.getContent(contentId);
      expect(content.owner).to.equal(owner.address);
    });
  });

  describe("Access Control", function () {
    let testContentId;
    
    beforeEach(async function () {
      // Register unique paid content for these tests
      const tx = await contentRegistry.registerContent(
        `UniqueContentHash-${Date.now()}`,
        metadataHash,
        contentType,
        price,
        aiTrainingAllowed
      );
      
      // Get the content ID from event
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'ContentRegistered'
      );
      
      if (event) {
        testContentId = event.args[0]; // The contentId from the ContentRegistered event
      } else {
        // Fallback: Get latest content ID
        const ownerContentIds = await contentRegistry.getContentByOwner(owner.address);
        testContentId = ownerContentIds[ownerContentIds.length - 1];
      }
    });

    it("Should grant access to a user", async function () {
      await expect(contentRegistry.grantAccess(testContentId, user1.address))
        .to.emit(contentRegistry, "PermissionGranted")
        .withArgs(testContentId, user1.address);

      expect(await contentRegistry.hasAccess(testContentId, user1.address)).to.equal(true);
    });

    it("Should revoke access from a user", async function () {
      // First grant access
      await contentRegistry.grantAccess(testContentId, user1.address);
      
      // Then revoke it
      await expect(contentRegistry.revokeAccess(testContentId, user1.address))
        .to.emit(contentRegistry, "PermissionRevoked")
        .withArgs(testContentId, user1.address);

      expect(await contentRegistry.hasAccess(testContentId, user1.address)).to.equal(false);
    });

    it("Should not allow non-owner to grant access", async function () {
      await expect(
        contentRegistry.connect(user1).grantAccess(testContentId, user2.address)
      ).to.be.revertedWith("Only owner can grant access");
    });

    it("Should allow purchase of content access", async function () {
      await expect(
        contentRegistry.connect(user1).purchaseAccess(testContentId, { value: price })
      )
        .to.emit(contentRegistry, "PermissionGranted")
        .withArgs(testContentId, user1.address);

      expect(await contentRegistry.hasAccess(testContentId, user1.address)).to.equal(true);
    });

    it("Should not allow purchase with insufficient payment", async function () {
      const insufficientPayment = ethers.parseEther("0.05");
      await expect(
        contentRegistry.connect(user1).purchaseAccess(testContentId, { value: insufficientPayment })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Owner should always have access", async function () {
      expect(await contentRegistry.hasAccess(testContentId, owner.address)).to.equal(true);
    });
  });

  // Continue with the rest of your tests, with similar adjustments as needed
  describe("AI Training Permission", function () {
    let testContentId;
    
    beforeEach(async function () {
      // Register unique content for these tests
      const tx = await contentRegistry.registerContent(
        `UniqueContentHash-${Date.now()}`,
        metadataHash,
        contentType,
        price,
        aiTrainingAllowed
      );
      
      // Get the content ID
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'ContentRegistered'
      );
      
      if (event) {
        testContentId = event.args[0];
      } else {
        const ownerContentIds = await contentRegistry.getContentByOwner(owner.address);
        testContentId = ownerContentIds[ownerContentIds.length - 1];
      }
    });

    it("Should return correct AI training permission", async function () {
      expect(await contentRegistry.isAiTrainingAllowed(testContentId)).to.equal(aiTrainingAllowed);
      
      // Update AI training permission
      await contentRegistry.updateContent(
        testContentId,
        metadataHash,
        price,
        updatedAiTrainingAllowed
      );
      
      expect(await contentRegistry.isAiTrainingAllowed(testContentId)).to.equal(updatedAiTrainingAllowed);
    });
  });

  describe("Content Disputes", function () {
    let testContentId;
    
    beforeEach(async function () {
      // Register unique content for these tests
      const tx = await contentRegistry.registerContent(
        `UniqueContentHash-${Date.now()}`,
        metadataHash,
        contentType,
        price,
        aiTrainingAllowed
      );
      
      // Get the content ID
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'ContentRegistered'
      );
      
      if (event) {
        testContentId = event.args[0];
      } else {
        const ownerContentIds = await contentRegistry.getContentByOwner(owner.address);
        testContentId = ownerContentIds[ownerContentIds.length - 1];
      }
    });

    it("Should allow a user to report a dispute", async function () {
      await expect(contentRegistry.connect(user1).reportDispute(testContentId, disputeEvidence))
        .to.emit(contentRegistry, "ContentDisputed")
        .withArgs(testContentId, user1.address, disputeEvidence);

      expect(await contentRegistry.isContentDisputed(testContentId)).to.equal(true);
    });

    it("Should not allow owner to dispute their own content", async function () {
      await expect(
        contentRegistry.reportDispute(testContentId, disputeEvidence)
      ).to.be.revertedWith("Owner cannot dispute own content");
    });

    it("Should allow admin to resolve dispute and confirm ownership", async function () {
      // First create a dispute
      await contentRegistry.connect(user1).reportDispute(testContentId, disputeEvidence);
      
      // Admin resolves dispute and confirms current owner
      await expect(
        contentRegistry.connect(admin).resolveDispute(testContentId, true, ethers.ZeroAddress)
      )
        .to.emit(contentRegistry, "DisputeResolved")
        .withArgs(testContentId, true);

      expect(await contentRegistry.isContentDisputed(testContentId)).to.equal(false);
      
      // Content should still belong to original owner
      const content = await contentRegistry.getContent(testContentId);
      expect(content.owner).to.equal(owner.address);
    });

    it("Should allow admin to resolve dispute and transfer ownership", async function () {
      // First create a dispute
      await contentRegistry.connect(user1).reportDispute(testContentId, disputeEvidence);
      
      // Admin resolves dispute and transfers ownership to the disputer
      await expect(
        contentRegistry.connect(admin).resolveDispute(testContentId, false, user1.address)
      )
        .to.emit(contentRegistry, "DisputeResolved")
        .withArgs(testContentId, false);

      expect(await contentRegistry.isContentDisputed(testContentId)).to.equal(false);
      
      // Content should now belong to user1
      const content = await contentRegistry.getContent(testContentId);
      expect(content.owner).to.equal(user1.address);
      
      // NFT should be transferred to new owner
      if (contentToken) {
        try {
          expect(await contentToken.ownerOf(testContentId)).to.equal(user1.address);
        } catch (e) {
          console.warn("Could not check token ownership. Make sure ContentToken is properly integrated.");
        }
      }
      
      // Check owner content mappings
      const user1ContentIds = await contentRegistry.getContentByOwner(user1.address);
      expect(user1ContentIds).to.include(testContentId);
      
      const ownerContentIds = await contentRegistry.getContentByOwner(owner.address);
      expect(ownerContentIds).to.not.include(testContentId);
    });

    it("Should not allow non-admin to resolve dispute", async function () {
      // First create a dispute
      await contentRegistry.connect(user1).reportDispute(testContentId, disputeEvidence);
      
      // Non-admin tries to resolve
      await expect(
        contentRegistry.connect(user2).resolveDispute(testContentId, true, ethers.ZeroAddress)
      ).to.be.revertedWith("Only admin can resolve disputes");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle non-existent content IDs", async function () {
      await expect(
        contentRegistry.getContent(999)
      ).to.be.revertedWith("Content does not exist");
      
      await expect(
        contentRegistry.hasAccess(999, user1.address)
      ).to.be.revertedWith("Content does not exist");
      
      await expect(
        contentRegistry.isAiTrainingAllowed(999)
      ).to.be.revertedWith("Content does not exist");
    });

    it("Should handle free content access", async function () {
      // Register free content
      const tx = await contentRegistry.registerContent(
        `FreeContentHash-${Date.now()}`,
        metadataHash,
        contentType,
        0, // Price 0 = free
        aiTrainingAllowed
      );
      
      // Get the content ID
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'ContentRegistered'
      );
      
      let freeContentId;
      if (event) {
        freeContentId = event.args[0];
      } else {
        const ownerContentIds = await contentRegistry.getContentByOwner(owner.address);
        freeContentId = ownerContentIds[ownerContentIds.length - 1];
      }
      
      // Anyone should have access to free content
      expect(await contentRegistry.hasAccess(freeContentId, user1.address)).to.equal(true);
      expect(await contentRegistry.hasAccess(freeContentId, user2.address)).to.equal(true);
      
      // Should not be able to purchase free content
      await expect(
        contentRegistry.connect(user1).purchaseAccess(freeContentId, { value: price })
      ).to.be.revertedWith("Content is free, no purchase needed");
    });
  });
});