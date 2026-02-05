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
                    # normalize rows to expected fields
                    norm_rows = []
                    for r in holdingslist:
                        rr = {}
                        # ticker/symbol compatibility
                        rr['ticker'] = r.get('ticker') or r.get('symbol') or ''
                        rr['quantity'] = r.get('quantity') or r.get('qty') or ''
                        # totalcost may come from totalcost or avgcost/curprice
                        if 'totalcost' in r and r.get('totalcost') != '':
                            rr['totalcost'] = r.get('totalcost')
                        elif 'avgcost' in r and r.get('avgcost') != '' and rr['quantity']:
                            try:
                                rr['totalcost'] = str(round(float(rr['quantity']) * float(r.get('avgcost')), 2))
                            except Exception:
                                rr['totalcost'] = ''
                        elif 'curprice' in r and r.get('curprice') != '' and rr['quantity']:
                            try:
                                rr['totalcost'] = str(round(float(rr['quantity']) * float(r.get('curprice')), 2))
                            except Exception:
                                rr['totalcost'] = ''
                        else:
                            rr['totalcost'] = r.get('totalcost','')
                        rr['lasttransactiondate'] = r.get('lasttransactiondate','')
                        norm_rows.append(rr)
                    # sort by lasttransactiondate descending (newest first) if available
                    try:
                        sorted_rows = sorted(norm_rows, key=lambda r: pandas.to_datetime(r.get('lasttransactiondate')), reverse=True)
                    except Exception:
                        sorted_rows = norm_rows
                    writer.writerows(sorted_rows)
                count = len(holdingslist)
                return f"Portfolio written successfully! Wrote {count} records to {outfile}"
    except FileNotFoundError:
        raise FileNotFoundError("Output file not found")
    except OSError:
        raise OSError("Output file could not be written")


# Sell a ticker from the current portfolio
def sell_ticker(holdingslist, symbol, amt):
    try:
        # allow numeric strings like '1' or '1.0' and numeric types
        try:
            amt_float = float(amt)
            if not float(amt_float).is_integer():
                raise ValueError("Input quantity is not an integer!")
            amt_int = int(amt_float)
        except Exception:
            raise ValueError("Input quantity is not an integer!")
        tickerprice = get_ticker_price(symbol)
        if tickerprice is None:
            raise Exception(f"Unable to fetch current price for {symbol}")
        # Proceed
        rowdict = {}
        subtracted = False
        for i in range(len(holdingslist)):
            rowdict = holdingslist[i]
            if symbol == rowdict.get("ticker"):
                try:
                    existingqty = int(float(rowdict.get("quantity", 0)))
                except Exception:
                    raise ValueError("Existing quantity is not a number")
                if existingqty < amt_int:
                    raise ValueError(f"Not enough holdings for {symbol}. Current holdings: {existingqty}; quantity to be sold: {amt_int}")
                else:
                    rowdict["quantity"] = existingqty - amt_int
                    rowdict["totalcost"] = round(float(rowdict.get("totalcost", 0)) - (amt_int * tickerprice), 2)
                    # record UTC timestamp for the transaction
                    rowdict["lasttransactiondate"] = pandas.Timestamp.now(tz='UTC').isoformat()
                    subtracted = True
                    break
        if not subtracted:
            raise Exception(f"No holdings for {symbol} in portfolio!")
        return holdingslist, f"Transaction completed successfully! Sold {amt_int} shares of {symbol} at ${tickerprice} each."
    except Exception as e:
        raise e


# Buy a ticker and add into the current portfolio
def buy_ticker(holdingslist, symbol, amt):
    try:
        # allow numeric strings like '1' or '1.0' and numeric types
        try:
            amt_float = float(amt)
            if not float(amt_float).is_integer():
                raise ValueError("Input quantity is not an integer!")
            amt_int = int(amt_float)
        except Exception:
            raise ValueError("Input quantity is not an integer!")
        tickerprice = get_ticker_price(symbol)
        if tickerprice is None:
            raise Exception(f"Unable to fetch current price for {symbol}")
        # Proceed
        rowdict = {}
        added = False
        for i in range(len(holdingslist)):
            rowdict = holdingslist[i]
            if symbol == rowdict.get("ticker"):
                try:
                    existingqty = int(float(rowdict.get("quantity", 0)))
                except Exception:
                    raise ValueError("Existing quantity is not a number")
                rowdict["quantity"] = existingqty + amt_int
                rowdict["totalcost"] = round(float(rowdict.get("totalcost", 0)) + (amt_int * tickerprice), 2)
                # record UTC timestamp for the transaction
                rowdict["lasttransactiondate"] = pandas.Timestamp.now(tz='UTC').isoformat()
                added = True
                break
        if not added:
            # use UTC ISO timestamp for transaction time
            utcnow = pandas.Timestamp.now(tz='UTC').isoformat()
            rowdict = {"ticker": symbol, "quantity": amt_int, "totalcost": round((amt_int * tickerprice), 2), "lasttransactiondate": utcnow}
            holdingslist.append(rowdict)
        return holdingslist, f"Transaction completed successfully! Bought {amt_int} shares of {symbol} at ${tickerprice} each."
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