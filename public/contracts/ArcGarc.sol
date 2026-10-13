// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice AScope greetings on Arc Mainnet. No token, mint, or transfer approval.
contract ArcGarc {
    uint256 public constant ARC_CHAIN_ID = 5042;
    string public constant MESSAGE = "gARC | AScope";
    address public deployer;
    uint256 public totalGreetings;
    mapping(address => uint256) public greetings;
    mapping(address => uint256) public lastGreetingAt;

    event Garc(address indexed wallet, uint256 walletCount, uint256 totalCount, uint256 timestamp, string message);

    constructor() {
        require(block.chainid == ARC_CHAIN_ID, "Arc Mainnet only");
        deployer = msg.sender;
    }

    /// @notice Records one greeting for the calling wallet. Only network gas is paid.
    function greet() external {
        uint256 walletCount = ++greetings[msg.sender];
        uint256 totalCount = ++totalGreetings;
        lastGreetingAt[msg.sender] = block.timestamp;
        emit Garc(msg.sender, walletCount, totalCount, block.timestamp, MESSAGE);
    }
}
