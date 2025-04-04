// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ContentToken.sol";
import "./MyAccessControl.sol";
import "./PaymentProcessor.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ContentRegistry
 * @dev Main contract for registering and tracking ownership of digital content
 */
contract ContentRegistry is MyAccessControl {
    // Content types
    enum ContentType { IMAGE, VIDEO, AUDIO, TEXT }
    
    // Content status
    enum ContentStatus { ACTIVE, INACTIVE, DISPUTED }
    
    // Content structure
    struct Content {
        uint256 id;
        address owner;
        string contentHash;        // IPFS hash or other content identifier
        string metadataHash;       // IPFS hash for metadata
        ContentType contentType;
        ContentStatus status;
        uint256 registrationTime;
        uint256 price;             // 0 for free content
        bool aiTrainingAllowed;    // Permission for AI training
        mapping(address => bool) authorizedUsers;
    }
    
    // Events
    event ContentRegistered(uint256 indexed contentId, address indexed owner, string contentHash, ContentType contentType);
    event ContentUpdated(uint256 indexed contentId, address indexed owner);
    event PermissionGranted(uint256 indexed contentId, address indexed user);
    event PermissionRevoked(uint256 indexed contentId, address indexed user);
    event ContentDisputed(uint256 indexed contentId, address indexed disputer, string evidence);
    event DisputeResolved(uint256 indexed contentId, bool ownershipConfirmed);
    
    // State variables
    uint256 private _contentIdCounter;
    mapping(uint256 => Content) private _contents;
    mapping(string => uint256) private _hashToContentId;
    mapping(address => uint256[]) private _ownerContentIds;
    
    
    ContentToken private _contentToken;
    MyAccessControl private _accessControl;
    PaymentProcessor private _paymentProcessor;

    constructor(address accessControlAddress, address paymentProcessorAddress) {
        _contentIdCounter = 1;
        _accessControl= MyAccessControl(accessControlAddress);
        _paymentProcessor = PaymentProcessor(paymentProcessorAddress);
        _contentToken = new ContentToken();

    }
    
    /**
     * @dev Register new content and mint an ownership token
     * @param contentHash Hash of the content (IPFS hash or other identifier)
     * @param metadataHash Hash of the content metadata
     * @param contentType Type of the content (IMAGE, VIDEO, AUDIO, TEXT)
     * @param price Price for accessing the content (0 for free)
     * @param aiTrainingAllowed Whether AI training is allowed on this content
     */
    function registerContent(
        string memory contentHash,
        string memory metadataHash,
        ContentType contentType,
        uint256 price,
        bool aiTrainingAllowed
    ) public returns (uint256) {
        // Check if content with this hash already exists
        require(_hashToContentId[contentHash] == 0, "Content with this hash already registered");
        
        // Create new content ID
        uint256 contentId = _contentIdCounter++;
        
        // Store content information
        Content storage newContent = _contents[contentId];
        newContent.id = contentId;
        newContent.owner = msg.sender;
        newContent.contentHash = contentHash;
        newContent.metadataHash = metadataHash;
        newContent.contentType = contentType;
        newContent.status = ContentStatus.ACTIVE;
        newContent.registrationTime = block.timestamp;
        newContent.price = price;
        newContent.aiTrainingAllowed = aiTrainingAllowed;
        
        // Update mappings
        _hashToContentId[contentHash] = contentId;
        _ownerContentIds[msg.sender].push(contentId);
        
        // Mint an NFT for this content to represent ownership
        _contentToken.mint(msg.sender, contentId, metadataHash);
        
        // Emit event
        emit ContentRegistered(contentId, msg.sender, contentHash, contentType);
        
        return contentId;
    }
    
    /**
     * @dev Get content information by ID
     */
    function getContent(uint256 contentId) public view returns (
        uint256 id,
        address owner,
        string memory contentHash,
        string memory metadataHash,
        ContentType contentType,
        ContentStatus status,
        uint256 registrationTime,
        uint256 price,
        bool aiTrainingAllowed
    ) {
        Content storage content = _contents[contentId];
        require(content.id > 0, "Content does not exist");
        
        return (
            content.id,
            content.owner,
            content.contentHash,
            content.metadataHash,
            content.contentType,
            content.status,
            content.registrationTime,
            content.price,
            content.aiTrainingAllowed
        );
    }
    
    /**
     * @dev Check if a content hash is registered
     * @param contentHash Hash of the content to check
     * @return contentId if registered, 0 if not
     */
    function isContentRegistered(string memory contentHash) public view returns (uint256) {
        return _hashToContentId[contentHash];
    }
    
    /**
     * @dev Get all content IDs owned by an address
     */
    function getContentByOwner(address owner) public view returns (uint256[] memory) {
        return _ownerContentIds[owner];
    }
    
    /**
     * @dev Update content metadata
     * @param contentId ID of the content to update
     * @param newMetadataHash New metadata hash
     * @param newPrice New price (0 for free)
     * @param newAiTrainingAllowed New AI training permission
     */
    function updateContent(
        uint256 contentId,
        string memory newMetadataHash,
        uint256 newPrice,
        bool newAiTrainingAllowed
    ) public {
        Content storage content = _contents[contentId];
        require(content.id > 0, "Content does not exist");
        require(content.owner == msg.sender, "Only owner can update content");
        
        content.metadataHash = newMetadataHash;
        content.price = newPrice;
        content.aiTrainingAllowed = newAiTrainingAllowed;
        
        emit ContentUpdated(contentId, msg.sender);
    }
    
    /**
     * @dev Grant access permission to a user for paid content
     * @param contentId ID of the content
     * @param user Address of the user to grant access
     */
    function grantAccess(uint256 contentId, address user) public {
        Content storage content = _contents[contentId];
        require(content.id > 0, "Content does not exist");
        require(content.owner == msg.sender, "Only owner can grant access");
        
        content.authorizedUsers[user] = true;
        emit PermissionGranted(contentId, user);
    }
    
    /**
     * @dev Revoke access permission from a user
     * @param contentId ID of the content
     * @param user Address of the user to revoke access
     */
    function revokeAccess(uint256 contentId, address user) public {
        Content storage content = _contents[contentId];
        require(content.id > 0, "Content does not exist");
        require(content.owner == msg.sender, "Only owner can revoke access");
        
        content.authorizedUsers[user] = false;
        emit PermissionRevoked(contentId, user);
    }
    
    /**
     * @dev Check if a user has access to content
     * @param contentId ID of the content
     * @param user Address of the user
     * @return True if user has access, false otherwise
     */
    function hasAccess(uint256 contentId, address user) public view returns (bool) {
        Content storage content = _contents[contentId];
        require(content.id > 0, "Content does not exist");
        
        // Owner always has access
        if (content.owner == user) {
            return true;
        }
        
        // Free content is accessible to all
        if (content.price == 0) {
            return true;
        }
        
        // Check if user is authorized
        return content.authorizedUsers[user];
    }
    
    /**
     * @dev Purchase access to paid content
     * @param contentId ID of the content to purchase
     */
    function purchaseAccess(uint256 contentId) public payable {
        Content storage content = _contents[contentId];
        require(content.id > 0, "Content does not exist");
        require(content.price > 0, "Content is free, no purchase needed");
        require(msg.value >= content.price, "Insufficient payment");
        
        // Process payment
        _paymentProcessor.processPayment{value: msg.value}(content.owner, content.price);
        
        // Grant access
        content.authorizedUsers[msg.sender] = true;
        emit PermissionGranted(contentId, msg.sender);
    }
    
    /**
     * @dev Check if AI training is allowed for a content
     * @param contentId ID of the content
     * @return True if AI training is allowed, false otherwise
     */
    function isAiTrainingAllowed(uint256 contentId) public view returns (bool) {
        Content storage content = _contents[contentId];
        require(content.id > 0, "Content does not exist");
        
        return content.aiTrainingAllowed;
    }
    
    /**
     * @dev Report a dispute for content ownership
     * @param contentId ID of the disputed content
     * @param evidence IPFS hash or other evidence of true ownership
     */
    function reportDispute(uint256 contentId, string memory evidence) public {
        Content storage content = _contents[contentId];
        require(content.id > 0, "Content does not exist");
        require(content.owner != msg.sender, "Owner cannot dispute own content");
        
        // Mark content as disputed
        content.status = ContentStatus.DISPUTED;
        
        emit ContentDisputed(contentId, msg.sender, evidence);
    }
    /**
    * @dev Returns the address of the ContentToken contract
    * @return Address of the ContentToken contract
    */
    function getContentTokenAddress() public view returns (address) {
        return address(_contentToken);
    }
    /**
     * @dev Resolve a dispute (only by admin)
     * @param contentId ID of the disputed content
     * @param ownershipConfirmed True if current owner is confirmed, false to transfer to disputer
     * @param newOwner Address of the new owner if ownership is transferred
     */
    function resolveDispute(uint256 contentId, bool ownershipConfirmed, address newOwner) public {
        require(_accessControl.isAdmin(msg.sender), "Only admin can resolve disputes");
        
        Content storage content = _contents[contentId];
        require(content.id > 0, "Content does not exist");
        require(content.status == ContentStatus.DISPUTED, "Content is not disputed");
        
        if (ownershipConfirmed) {
            // Confirm current ownership
            content.status = ContentStatus.ACTIVE;
        } else {
            // Transfer ownership
            address previousOwner = content.owner;
            content.owner = newOwner;
            content.status = ContentStatus.ACTIVE;
            
            // Update owner content IDs
            // Remove from previous owner
            uint256[] storage previousOwnerContents = _ownerContentIds[previousOwner];
            for (uint i = 0; i < previousOwnerContents.length; i++) {
                if (previousOwnerContents[i] == contentId) {
                    previousOwnerContents[i] = previousOwnerContents[previousOwnerContents.length - 1];
                    previousOwnerContents.pop();
                    break;
                }
            }
            
            // Add to new owner
            _ownerContentIds[newOwner].push(contentId);
            
            // Transfer token
            _contentToken.transferFrom(previousOwner, newOwner, contentId);
        }
        
        emit DisputeResolved(contentId, ownershipConfirmed);
    }
    
    /**
     * @dev Check if a content is in disputed state
     */
    function isContentDisputed(uint256 contentId) public view returns (bool) {
        Content storage content = _contents[contentId];
        require(content.id > 0, "Content does not exist");
        
        return content.status == ContentStatus.DISPUTED;
    }


}
