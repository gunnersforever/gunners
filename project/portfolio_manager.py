import csv, pandas, requests


# Retrieve a saved portfolio (csv) into memory
def retrieve_portfolio(infile):
    try:
        holdingslist = []
        if check_file_is_csv(infile) == False:
            raise Exception("Not a CSV file")
        else:
            # Read the file and load each line into memory
            with open(infile, newline="") as rfile:
                dict_reader = csv.DictReader(rfile)
                for row in dict_reader:
                    holdingslist.append(row)
        return holdingslist, "Portfolio retrieved successfully!"
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
                raise ValueError("Not a CSV file")
            else:
                with open(outfile, 'w', newline='') as wfile:
                    fieldnames = ["ticker", "quantity", "totalcost", "lasttransactiondate"]
                    writer = csv.DictWriter(wfile, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(holdingslist)
                return "Portfolio written successfully!"
    except FileNotFoundError:
        raise FileNotFoundError("Output file not found")
    except OSError:
        raise OSError("Output file could not be written")


# Sell a ticker from the current portfolio
def sell_ticker(holdingslist, symbol, amt):
    try:
        if not str(amt).isdigit():
            raise ValueError("Input quantity is not an integer!")
        tickerprice = get_ticker_price(symbol)
        if tickerprice is None:
            raise Exception(f"Unable to fetch current price for {symbol}")
        # Assume proceed, no input
        rowdict = {}
        subtracted = False
        for i in range(len(holdingslist)):
            rowdict = holdingslist[i]
            if symbol == rowdict["ticker"]:
                existingqty = int(rowdict["quantity"])
                if existingqty < int(amt):
                    raise ValueError(f"Not enough holdings for {symbol}. Current holdings: {existingqty}; quantity to be sold: {amt}")
                else:
                    rowdict["quantity"] = existingqty - int(amt)
                    rowdict["totalcost"] = round(float(rowdict["totalcost"]) - (int(amt) * tickerprice), 2)
                    subtracted = True
                    break
        if not subtracted:
            raise Exception(f"No holdings for {symbol} in portfolio!")
        return holdingslist, f"Transaction completed successfully! Sold {amt} shares of {symbol} at ${tickerprice} each."
    except Exception as e:
        raise e


# Buy a ticker and add into the current portfolio
def buy_ticker(holdingslist, symbol, amt):
    try:
        if not str(amt).isdigit():
            raise ValueError("Input quantity is not an integer!")
        tickerprice = get_ticker_price(symbol)
        if tickerprice is None:
            raise Exception(f"Unable to fetch current price for {symbol}")
        # Assume proceed
        rowdict = {}
        added = False
        for i in range(len(holdingslist)):
            rowdict = holdingslist[i]
            if symbol == rowdict["ticker"]:
                rowdict["quantity"] = int(rowdict["quantity"]) + int(amt)
                rowdict["totalcost"] = round(float(rowdict["totalcost"]) + (int(amt) * tickerprice), 2)
                added = True
                break
        if not added:
            rowdict = {"ticker": symbol, "quantity": amt, "totalcost": round((int(amt) * tickerprice), 2), "lasttransactiondate": pandas.to_datetime("today").isoformat()}
            holdingslist.append(rowdict)
        return holdingslist, f"Transaction completed successfully! Bought {amt} shares of {symbol} at ${tickerprice} each."
    except Exception as e:
        raise e


def check_file_is_csv(filename):
    if not filename.lower().endswith('.csv'):
        return False
    return True


def get_ticker_price(symbol):
    api_key = 'd619kb9r01qn5qe72j2gd619kb9r01qn5qe72j30'  # Replace with your actual FinnHub API key
    url = f'https://finnhub.io/api/v1/quote?symbol={symbol}&token={api_key}'
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        return round(data['c'], 2)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching price from FinnHub: {e}")
        return None
    except KeyError:
        print("Error: 'c' key not found in response")
        return None