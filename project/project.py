import sys
from portfolio_manager import retrieve_portfolio, write_portfolio, buy_ticker, sell_ticker, get_ticker_price


def main():
    print("======================================================")
    print("Welcome to Portfolio Management Tool 1.0")
    print("Enter \"R\" to retrieve a portfolio from a saved file")
    print("Enter \"W\" to write the current portfolio into a file")
    print("Enter \"B\" to buy a ticker with quantity and add that into the current portfolio")
    print("Enter \"S\" to sell a ticker with quantity from the current portfolio")
    print("Enter \"P\" to display the current portfolio content")
    print("Press \"Ctrl-C\" to exit the program")
    print("======================================================")

    # Program designed to be interactive and keep waiting for next user instruction until Ctrl-C (EOF) is received
    # Data structure to be a list of dictionaries, e.g. [{....}, {....}, {....}, {....}] with 4 columns namely ticker, quantity, totalcost and lasttransactiondate
    holdingslist = []
    while True:
        try:
            ins = input("Instruction: ").strip().upper()
            match ins:
                case "P":
                    if holdingslist:
                        for item in holdingslist:
                            print(item)
                case "R":
                    infile = input("Please specify the portfolio file name (in CSV): ")
                    resultlist, message = retrieve_portfolio(infile)
                    print(f">> {message}")
                    holdingslist = resultlist
                case "W":
                    outfile = input("Please specify the portfolio file name (in CSV): ")
                    message = write_portfolio(holdingslist, outfile)
                    print(f">> {message}")
                case "B":
                    symbol, amt = input("Please enter the ticker, followed by \",\", and the desired quantity: ").upper().split(",")
                    amt = amt.strip()
                    tickerprice = get_ticker_price(symbol)
                    if tickerprice is None:
                        print(f"Error: Unable to fetch current price for {symbol}")
                        continue
                    response = input(f"{symbol} is currently trading at ${tickerprice}. Do you want to proceed (y/n)? ")
                    if response.lower() == "y":
                        holdingslist, message = buy_ticker(holdingslist, symbol, amt)
                        print(f">> {message}")
                case "S":
                    symbol, amt = input("Please enter the ticker, followed by \",\", and the desired quantity: ").upper().split(",")
                    amt = amt.strip()
                    tickerprice = get_ticker_price(symbol)
                    if tickerprice is None:
                        print(f"Error: Unable to fetch current price for {symbol}")
                        continue
                    response = input(f"{symbol} is currently trading at ${tickerprice}. Do you want to proceed (y/n)? ")
                    if response.lower() == "y":
                        holdingslist, message = sell_ticker(holdingslist, symbol, amt)
                        print(f">> {message}")
        except (EOFError, KeyboardInterrupt):
            # Ctrl-C for exiting the program
            print("\nThank you for using Portfolio Management Tool v1.0. Goodbye!")
            sys.exit(0)
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    main()
