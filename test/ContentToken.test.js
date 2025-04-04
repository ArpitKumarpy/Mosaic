const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ContentToken", function () {
  let ContentToken;
  let contentToken;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy ContentToken without parameters
    ContentToken = await ethers.getContractFactory("ContentToken");
    contentToken = await ContentToken.deploy();
    
    // No need to call deployed() in newer ethers.js versions
    
    // You can validate the hardcoded name and symbol
    expect(await contentToken.name()).to.equal("ContentToken");
    expect(await contentToken.symbol()).to.equal("CTK");
  });

  describe("Minting", function () {
    it("Should mint a token with auto-incremented ID", async function () {
      const tokenURI = "https://example.com/token/1";
      
      // Mint token with auto-incremented ID
      await contentToken.mint(user1.address, tokenURI);
      
      // The first token should have ID 0
      expect(await contentToken.ownerOf(0)).to.equal(user1.address);
      expect(await contentToken.tokenURI(0)).to.equal(tokenURI);
    });

    // Rest of your tests...
  });

  describe("Token Transfers", function () {
    beforeEach(async function () {
      // Mint a token for testing transfers
      await contentToken.mint(user1.address, "https://example.com/token/1");
    });

    it("Should transfer tokens between accounts", async function () {
      // Transfer token 0 from user1 to user2
      await contentToken.connect(user1).transferFrom(user1.address, user2.address, 0);
      
      expect(await contentToken.ownerOf(0)).to.equal(user2.address);
    });

    it("Should check for proper authorization before transfer", async function () {
      // Try to transfer without approval
      await expect(
        contentToken.connect(user2).transferFrom(user1.address, user2.address, 0)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Token Approvals", function () {
    beforeEach(async function () {
      // Mint a token for testing approvals
      await contentToken.mint(user1.address, "https://example.com/token/1");
    });

    it("Should allow approved address to transfer tokens", async function () {
      // user1 approves user2 to transfer token 0
      await contentToken.connect(user1).approve(user2.address, 0);
      
      // user2 transfers token 0 from user1 to themselves
      await contentToken.connect(user2).transferFrom(user1.address, user2.address, 0);
      
      expect(await contentToken.ownerOf(0)).to.equal(user2.address);
    });

    it("Should verify isApprovedOrOwner works correctly", async function () {
      // Initial check - user2 should not be approved
      expect(await contentToken.isApprovedOrOwner(user2.address, 0)).to.equal(false);
      
      // After approval, user2 should be approved
      await contentToken.connect(user1).approve(user2.address, 0);
      expect(await contentToken.isApprovedOrOwner(user2.address, 0)).to.equal(true);
    });
  });
});