from project import get_ticker_price, check_file_is_csv, write_portfolio, retrieve_portfolio
import pandas, pytest, os


def test_get_ticker_price_1():
    assert isinstance(get_ticker_price("NVDA"), float) == True
    assert isinstance(get_ticker_price("TSM"), float) == True
    assert isinstance(get_ticker_price("TSLA"), float) == True
    assert isinstance(get_ticker_price("RY"), float) == True


# Attempt to retrieve the price of an erroneous/non-existent ticker
def test_get_ticker_price_2():
    with pytest.raises(Exception):
        assert get_ticker_price("1234567")


def test_check_file_is_csv():
    assert check_file_is_csv("test01.csv") == True
    assert check_file_is_csv("requirements.txt") == False
    assert check_file_is_csv("portfolio.cs") == False
    assert check_file_is_csv("test.02.csv") == True
    assert check_file_is_csv("test03.CSV") == True
    assert check_file_is_csv("anothertest.csv.123") == False


def test_write_portfolio_1():
    holdingslist = [{"ticker":"NVDA", "quantity":15, "totalcost":3500.00, "lasttransactiondate":pandas.to_datetime("today")}]
    holdingslist.append({"ticker":"TSM", "quantity":33, "totalcost":1400.00, "lasttransactiondate":pandas.to_datetime("today")})
    write_portfolio(holdingslist, "pytest_01.csv")
    assert os.path.exists("pytest_01.csv") == True


# Attempt to write a file when holding list is empty
def test_write_portfolio_2():
    holdingslist = []
    with pytest.raises(ValueError):
        write_portfolio(holdingslist, "pytest_01.csv")


# Attempt to retrieve a non-existent file
def test_retrieve_portfolio_1():
    with pytest.raises(FileNotFoundError):
        retrieve_portfolio("notexist.csv")


# Retrieve a properly generated csv file that was created earlier in the test
def test_retrieve_portfolio_2():
    holdingslist = retrieve_portfolio("pytest_01.csv")
    assert len(holdingslist) == 2

