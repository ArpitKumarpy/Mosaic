// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PaymentProcessor
 * @dev Handles payments for content access and subscriptions
 */
contract PaymentProcessor is Ownable {
    uint256 private _platformFeePercentage;  // Fee percentage (in basis points, e.g., 250 = 2.5%)
    address private _feeRecipient;           // Platform fee recipient

    // Events
    event PaymentProcessed(address indexed from, address indexed to, uint256 amount, uint256 fee);
    event FeePercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    /**
     * @dev Constructor to initialize contract with fee percentage and recipient.
     * @param feePercentage Platform fee percentage (e.g., 250 = 2.5%)
     * @param feeRecipient Address receiving the platform fee
     */
    constructor(uint256 feePercentage, address feeRecipient) Ownable(msg.sender) {
        require(feePercentage <= 3000, "Fee percentage too high"); // Max 30%
        require(feeRecipient != address(0), "Invalid fee recipient"); // Prevent zero address

        _platformFeePercentage = feePercentage;
        _feeRecipient = feeRecipient;
    }

    /**
     * @dev Process a payment from a buyer to a seller
     * @param seller Address of the content seller
     * @param amount Amount to be paid
     */
    function processPayment(address seller, uint256 amount) public payable {
        require(msg.value >= amount, "Insufficient payment");

        uint256 fee = (amount * _platformFeePercentage) / 10000;
        uint256 sellerAmount = amount - fee;

        // Transfer amount to seller
        (bool sellerSuccess, ) = payable(seller).call{value: sellerAmount}("");
        require(sellerSuccess, "Failed to send payment to seller");

        // Transfer fee to fee recipient
        if (fee > 0) {
            (bool feeSuccess, ) = payable(_feeRecipient).call{value: fee}("");
            require(feeSuccess, "Failed to send fee to recipient");
        }

        // Refund excess payment if any
        uint256 excess = msg.value - amount;
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Failed to refund excess payment");
        }

        emit PaymentProcessed(msg.sender, seller, amount, fee);
    }

    /**
     * @dev Set the platform fee percentage
     * @param newFeePercentage New fee percentage in basis points (e.g., 250 = 2.5%)
     */
    function setFeePercentage(uint256 newFeePercentage) public onlyOwner {
        require(newFeePercentage <= 3000, "Fee percentage too high");

        uint256 oldFeePercentage = _platformFeePercentage;
        _platformFeePercentage = newFeePercentage;

        emit FeePercentageUpdated(oldFeePercentage, newFeePercentage);
    }

    /**
     * @dev Set the fee recipient address
     * @param newFeeRecipient New fee recipient address
     */
    function setFeeRecipient(address newFeeRecipient) public onlyOwner {
        require(newFeeRecipient != address(0), "Invalid fee recipient");

        address oldFeeRecipient = _feeRecipient;
        _feeRecipient = newFeeRecipient;

        emit FeeRecipientUpdated(oldFeeRecipient, newFeeRecipient);
    }

    /**
     * @dev Get the current platform fee percentage
     */
    function getFeePercentage() public view returns (uint256) {
        return _platformFeePercentage;
    }

    /**
     * @dev Get the current fee recipient address
     */
    function getFeeRecipient() public view returns (address) {
        return _feeRecipient;
    }
}