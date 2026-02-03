# Portfolio Management Tool (PMT) v1.0
#### Video demo:
https://youtu.be/--gsD1vssQM

#### Description:
Portfolio Management Tool (PMT) is a simple tool for investment advisors to manage their client's portfolio through buying and selling tickers (currently limited to those listed in US) using real-time prices provisioned by Yahoo! Finance. Investment advisors can also save (write) and retrieve (read) client portfolios into csv files. PMT also traces the Total Cost of Ownership (TCO) of each ticker by recording the costs during buys and substracting the receipts from sells.

## Table of Contents
- [Introduction](#introduction)
   - [Installation](#installation)
   - [How PMT works](#how-pmt-works)
   - [Assumptions](#assumptions)
   - [How to run](#how-to-run)
- [Code and functions](#code-and-functions)
   - [retrieve_portfolio()](#retrieve_portfolio)
   - [write_portfolio(list)](#write_portfolio(list))
   - [sell_ticker(list)](#sell_ticker(list))
   - [buy_ticker(list)](#buy_ticker(list))
   - [get_ticker_price(str)](#get_ticker_price(str))
   - [check_file_is_csv(str)](#check_file_is_csv(str))
   - [Third party libraries](#third-party-libraries)
- [Future improvement ideas](#future-improvement-ideas)

## Introduction
PMT is a command-prompt interactive tool that allows users who act as investment advisors to manage their client's portfolio via pre-defined instructions.

### Installation
There are 2 third-party libraries required to be installed in advance (please refer to "Third party libraries" section for details).

### How PMT works
PMT is a console-based application where users can interactively enter instructions to retrieve a portfolio, save the current portfolio, buy a ticker, sell an existing ticker, and view the current portfolio content. PMT queries the real-time prices from Yahoo! Finance via a third-party library, prompts users to confirm if they want to proceed with the price, and executes the instruction. PMT resembles the real world use cases where investment advisors require to manage clients' portfolio through various buy and sell orders.

### Assumptions
- PMT does not take into account any transaction fees, such as exchange charges, bank charges, applicable taxes etc. The values of buy and sell instructions are simply calculated as the product of quantity and current price (rounded to 2 decimal places)
- All transactions in PMT are done in currency native to the ticker, i.e. USD
- PMT does not handle any corporate actions events such as dividends, stock splits and mergers.

### How to run
In a python-enabled command line, and in the ~/project directory, run the program by calling "python project.py".

## Code and functions

### retrieve_portfolio()
This function asks for an input of an existing portfolio file in the same folder, i.e. ~/project, with the extension .csv, parses the csv file and load each row into a list of dictionaries in defined format in memory. This function allows users to switch to other portfolios without quitting and re-running the PMT program.

### write_portfolio(list)
This function takes an existing holdings list in memory, prompts for an input of desired output file name in csv, and writes its content into the designated file name in the same directory (~/project) accordingly. This allows users to store existing portfolio into persistent storage for future reference/usage.

### sell_ticker(list)
This function takes in an existing holdings list in memory, prompts for an input of desired ticker symbol and quantity to be sold, and performs the sell action by deducting the portion of holdings as well as the total cost from the holdings list. This function performs necessary validation whether the ticker exists in the holdings and whether a valid price can be fetched. It returns the updated holdings list to the caller.

### buy_ticker(list)
This function takes in an existing holdings list in memory, prompts for an input of desired ticker symbol and quantity to be bought, and performs the buy action by adding into the holdings list.  This function validates whether the ticker and price can be obtained, and performs the logic to either add a new entry to the holdings list, or to add this buy portion into the existing holdings record. It returns the updated holdings list to the caller.

### get_ticker_price(str)
This function takes in the ticker symbol as string and performs a lookup for price provisioned by Yahoo! Finance via a third-party library named yfinance. It returns a price represented in float and rounded in 2 decimal places.

### check_file_is_csv(str)
This is a boolean function that takes in the file name as string and performs a sanity check on whether it ends with ".csv". It returns either True or False.

### Third party libraries
There are a total of 4 third-party libraries used in PMT:
1. sys
2. csv
3. yfinance - for obtaining real-time ticker prices provisioned by Yahoo! Finance
4. pandas - for obtaining the current timestamp in user-friendly format

## Future improvement ideas
1. #### Provision of Profit-and-Loss (PnL) by the following:
    - Track, for each ticker, each buy and sell instruction with the execution price
    - Calculate real-time PnL per ticker and record as extra column (i.e. additional key-value pair in dictionary)
    - Return the PnL for entire portfolio by summing all the individual PnL per ticker
2. #### Support deposits and withdrawals of cash
    - Support the investment cash account cash balance by allowing users to deposit or withdraw to/from the account, to mimic the real world use cases
    - Proceeds from sell instructions would add balance into the investment cash account
    - Additional balance check required for each buy instruction, and reject any buy instruction if insufficient cash balance observed.
3. #### Support foreign currency exchanges (FX)
    - Further divide cash account into multiple cash accounts per currency, for instance USD (US dollar), CAD (Canadian dollar), EUR (Euro), GBP (British Pounds) etc.
    - Retrieve real-time FX rates for particular pair (e.g. CAD to USD) and ask for user confirmation.  As FX rates often changes hence make a timeout such as 20 seconds max. FX rate needs to be re-fetched again if timeout.
4. #### Support concurrent usage
    - File locking is required should there be cases where more than one users accessing the same portfolio, which in such cases race conditions might occur, for instance buying or selling the same ticker at the same time.
5. #### Persistent storage using database
    - While csv files serve the purpose of storing different portfolio, using database (e.g. MySQL) is preferred should this program be used at  scale, to support more seamless operations as well as concurrent usages as mentioned in above #4.
