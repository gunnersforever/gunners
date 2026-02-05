from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import csv
import io
import os
import logging
from portfolio_manager import retrieve_portfolio, write_portfolio, buy_ticker, sell_ticker, check_file_is_csv, get_ticker_price

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Portfolio Management API", version="1.0")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global holdings list (in production, use a database)
holdingslist = []

@app.get("/portfolio")
def get_portfolio():
    return {"portfolio": holdingslist}

@app.post("/portfolio/load")
def load_portfolio(file: UploadFile = File(...)):
    logging.info("Load request: %s", file.filename)
    global holdingslist
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    try:
        content = file.file.read().decode('utf-8')
        holdingslist = []
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            holdingslist.append(row)
        return {"message": "Portfolio loaded successfully!", "portfolio": holdingslist}
    except Exception as e:
        logging.error("Load error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/portfolio/save")
def save_portfolio(data: dict):
    logging.info("Save request: %s", data)
    filename = data.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="Filename required")
    full_path = os.path.join(os.path.dirname(__file__), filename)
    logging.info("Saving to: %s", full_path)
    try:
        logging.info("Saving portfolio with %d records", len(holdingslist))
        message = write_portfolio(holdingslist, full_path)
        logging.info("Save result: %s", message)
        return {"message": message, "saved_count": len(holdingslist)}
    except Exception as e:
        logging.error("Save error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/buy")
def buy(data: dict):
    logging.info("Buy request: %s", data)
    symbol = data.get("symbol")
    quantity = data.get("quantity")
    if not symbol or not quantity:
        raise HTTPException(status_code=400, detail="Symbol and quantity required")
    try:
        global holdingslist
        holdingslist, message = buy_ticker(holdingslist, symbol, str(quantity))
        return {"message": message, "portfolio": holdingslist}
    except Exception as e:
        logging.error("Buy error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get_price")
def get_price(symbol: str):
    price = get_ticker_price(symbol)
    logging.info("Get price for %s: %s", symbol, price)
    if price is None:
        raise HTTPException(status_code=400, detail="Unable to fetch price")
    return {"price": price}

@app.post("/sell")
def sell(data: dict):
    logging.info("Sell request: %s", data)
    global holdingslist
    symbol = data.get("symbol")
    quantity = data.get("quantity")
    if not symbol or not quantity:
        raise HTTPException(status_code=400, detail="Symbol and quantity required")
    try:
        holdingslist, message = sell_ticker(holdingslist, symbol, str(quantity))
        logging.info("Sell completed: %s", message)
        return {"message": message, "portfolio": holdingslist}
    except Exception as e:
        logging.error("Sell error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/portfolio/file/{filename}")
def get_portfolio_file(filename: str):
    # Basic validation to avoid directory traversal
    if '..' in filename or '/' in filename or '\\' in filename or not filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid filename")
    full_path = os.path.join(os.path.dirname(__file__), filename)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full_path, media_type='text/csv', filename=filename)