import csv, yfinance, pandas, sys


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
                    if holdingslist != None:
                        for i in range(len(holdingslist)):
                            print(holdingslist[i])
                case "R":
                    infile = input("Please specify the portfolio file name (in CSV): ")
                    resultlist = retrieve_portfolio(infile)
                    if resultlist != None:
                        holdingslist = resultlist
                case "W":
                    outfile = input("Please specify the portfolio file name (in CSV): ")
                    write_portfolio(holdingslist, outfile)
                case "B":
                    symbol, amt = input("Please enter the ticker, followed by \",\", and the desired quantity: ").upper().split(",")
                    resultlist = buy_ticker(holdingslist, symbol, amt)
                    if resultlist != None:
                        holdingslist = resultlist
                case "S":
                    symbol, amt = input("Please enter the ticker, followed by \",\", and the desired quantity: ").upper().split(",")
                    resultlist = sell_ticker(holdingslist, symbol, amt)
                    if resultlist != None:
                        holdingslist = resultlist
        except (EOFError, KeyboardInterrupt):
            # Ctrl-C for exiting the program
            print("\nThank you for using Portfolio Management Tool v1.0. Goodbye!")
            sys.exit(0)
        except Exception as e:
            print(f"Error: {e}")


# Retrieve a saved portfolio (csv) into memory
def retrieve_portfolio(infile):
    try:
        holdingslist = []
        if check_file_is_csv(infile) == False:
            raise Exception("Not a CSV file")
        else:
            # Read the file and load each line into memory
            with open(infile, newline="") as rfile:
                dict = csv.DictReader(rfile)
                for row in dict:
                    holdingslist.append(row)
        print(">> Portfolio retrieved successfully!")
        return holdingslist
    except FileNotFoundError:
        raise FileNotFoundError("Input file does not exist")
    except OSError:
        raise OSError("Input file could not be read")


# Write a portfolio in memory into a flat file
def write_portfolio(holdingslist, outfile):
    try:
        if holdingslist == []:
            raise ValueError("Portfolio is empty. Please add ticker(s) into portfolio and try again.")
        else:
            if check_file_is_csv(outfile) == False:
                raise FileNotFoundError("Not a CSV file")
            else:
                with open(outfile, 'w', newline='') as wfile:
                    fieldnames = ["ticker", "quantity", "totalcost", "lasttransactiondate"]
                    writer = csv.DictWriter(wfile, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(holdingslist)
                print(">> Portfolio written successfully!")
    except FileNotFoundError:
        raise FileNotFoundError("Output file not found")
    except OSError:
        raise OSError("Output file could not be written")


# Sell a ticker from the current portfolio
def sell_ticker(holdingslist, symbol, amt):
    try:
        if str(amt).isdigit() == False:
            raise ValueError("Input quantity is not an integer!")
        tickerprice = get_ticker_price(symbol)
        response = input(symbol + " is currently trading at $" + str(tickerprice) + ". Do you want to proceed (y/n)? ")
        if response.lower() == "y":
            rowdict = {}
            subtracted = False
            for i in range(len(holdingslist)):
                rowdict = holdingslist[i]
                if symbol == rowdict["ticker"]:
                    existingqty = int(rowdict["quantity"])
                    if existingqty < int(amt):
                        raise ValueError("Not enough holdings for "+symbol+". Current holdings: "+str(existingqty)+"; quantity to be sold: "+str(amt))
                    else:
                        rowdict["quantity"] = int(existingqty) - int(amt)
                        rowdict["totalcost"] = round(float(rowdict["totalcost"]) - (int(amt)*tickerprice), 2)
                        print(">> Transaction completed successfully!")
                        subtracted = True
                        break
                else:
                    continue
            if not subtracted:
                raise Exception("No holdings for "+symbol+" in portfolio!")
        return holdingslist
    except Exception as e:
        print(f"Error: {e}")


# Buy a ticker and add into the current portfolio
def buy_ticker(holdingslist, symbol, amt):
    try:
        if str(amt).isdigit() == False:
            raise ValueError("Input quantity is not an integer!")
        tickerprice = get_ticker_price(symbol)
        response = input(symbol + " is currently trading at $" + str(tickerprice) + ". Do you want to proceed (y/n)? ")
        if response.lower() == "y":
            rowdict = {}
            added = False
            for i in range(len(holdingslist)):
                rowdict = holdingslist[i]
                if symbol == rowdict["ticker"]:
                    rowdict["quantity"] = int(rowdict["quantity"]) + int(amt)
                    rowdict["totalcost"] = round(float(rowdict["totalcost"]) + (int(amt)*tickerprice), 2)
                    added = True
                    break
            if not added:
                rowdict = {"ticker":symbol, "quantity":amt, "totalcost":round((int(amt)*tickerprice),2), "lasttransactiondate":pandas.to_datetime("today")}
                holdingslist.append(rowdict)
            print(">> Transaction completed successfully!")
            return holdingslist
        else:
            return holdingslist
    except Exception as e:
        print(f"Error: {e}")


def check_file_is_csv(filename):
    length = len(filename)
    if filename[length-4:length].lower() != ".csv":
        return False
    else:
        return True


def get_ticker_price(symbol):
    try:
        return round(yfinance.Ticker(symbol).info["currentPrice"], 2)
    except Exception:
        # Fallback approach to attempt using previous key to obtain price
        return round(yfinance.Ticker(symbol).info["regularMarketPrice"], 2)


if __name__ == "__main__":
    main()
