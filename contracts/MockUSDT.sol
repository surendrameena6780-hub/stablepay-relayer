// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockUSDT {
    string public constant name = "Mock Tether USD";
    string public constant symbol = "USDT";
    uint8 private immutable tokenDecimals;
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error InvalidAddress();
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor(uint8 customDecimals) {
        owner = msg.sender;
        tokenDecimals = customDecimals;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function decimals() public view returns (uint8) {
        return tokenDecimals;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidAddress();
        }

        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert InvalidAddress();
        }

        totalSupply += amount;
        balanceOf[to] += amount;

        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) {
            revert InvalidAddress();
        }

        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];

        if (allowed < amount) {
            revert InsufficientAllowance();
        }

        allowance[from][msg.sender] = allowed - amount;
        emit Approval(from, msg.sender, allowance[from][msg.sender]);
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) {
            revert InvalidAddress();
        }

        uint256 senderBalance = balanceOf[from];

        if (senderBalance < amount) {
            revert InsufficientBalance();
        }

        balanceOf[from] = senderBalance - amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
    }
}