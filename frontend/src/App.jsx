import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Box,
  Alert,
  Grid,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  '&.MuiTableCell-head': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.common.white,
  },
}));

function App() {
  const [portfolio, setPortfolio] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [screen, setScreen] = useState('load');
  const [action, setAction] = useState('buy');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saveFile, setSaveFile] = useState('');

  const API_BASE = 'http://localhost:8000'; // Adjust if backend port changes

  useEffect(() => {
    if (screen === 'main') {
      fetchPortfolio();
    }
  }, [screen]);

  const fetchPortfolio = async () => {
    try {
      const response = await fetch(`${API_BASE}/portfolio`);
      const data = await response.json();
      setPortfolio(data.portfolio);
    } catch (err) {
      setError('Failed to fetch portfolio');
    }
  };

  const handleFileLoad = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${API_BASE}/portfolio/load`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setPortfolio(data.portfolio);
        setMessage(data.message);
        setError('');
        setScreen('main');
      } else {
        setError(data.detail);
      }
    } catch (err) {
      setError('Failed to load portfolio');
    }
  };

  const handleNewPortfolio = () => {
    setPortfolio([]);
    setScreen('main');
    setMessage('Started new portfolio');
  };

  const handleProceed = async () => {
    if (!symbol || !quantity) {
      setError('Please enter both symbol and quantity');
      return;
    }
    // Fetch price
    try {
      const response = await fetch(`${API_BASE}/get_price?symbol=${symbol.toUpperCase()}`);
      if (!response.ok) throw new Error('Failed to fetch price');
      const data = await response.json();
      setPrice(data.price);
      setDialogOpen(true);
      setError('');
    } catch (err) {
      setError('Failed to fetch price');
    }
  };

  const handleConfirm = async () => {
    setDialogOpen(false);
    try {
      const endpoint = action === 'buy' ? 'buy' : 'sell';
      const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.toUpperCase(), quantity: parseInt(quantity) }),
      });
      const data = await response.json();
      if (response.ok) {
        setPortfolio(data.portfolio);
        setMessage(data.message);
        setError('');
        setSymbol('');
        setQuantity('');
        setPrice(null);
      } else {
        setError(data.detail);
      }
    } catch (err) {
      setError(`Failed to ${action} stock`);
    }
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setPrice(null);
  };

  const handleSave = async () => {
    if (!saveFile) {
      setError('Please enter a filename to save');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/portfolio/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: saveFile }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message);
        setError('');
      } else {
        setError(data.detail);
      }
    } catch (err) {
      setError('Failed to save portfolio');
    }
  };

  if (screen === 'load') {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Portfolio Management Tool
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Choose an Option
            </Typography>
            <Box sx={{ mb: 2 }}>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileLoad}
                style={{ display: 'block', marginBottom: 8 }}
              />
              <Typography variant="body2" color="textSecondary">
                Select a CSV file to load an existing portfolio
              </Typography>
            </Box>
            <Button variant="contained" onClick={handleNewPortfolio} fullWidth>
              Start New Portfolio
            </Button>
          </CardContent>
        </Card>
        {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Portfolio Management Tool
      </Typography>
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Current Portfolio
              </Typography>
              {portfolio.length === 0 ? (
                <Typography>No holdings in portfolio</Typography>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <StyledTableCell>Ticker</StyledTableCell>
                        <StyledTableCell align="right">Quantity</StyledTableCell>
                        <StyledTableCell align="right">Total Cost</StyledTableCell>
                        <StyledTableCell>Last Transaction Date</StyledTableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {portfolio.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.ticker}</TableCell>
                          <TableCell align="right">{row.quantity}</TableCell>
                          <TableCell align="right">${row.totalcost}</TableCell>
                          <TableCell>{row.lasttransactiondate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Buy / Sell Stock
              </Typography>
              <ToggleButtonGroup
                value={action}
                exclusive
                onChange={(e, newAction) => newAction && setAction(newAction)}
                sx={{ mb: 2 }}
              >
                <ToggleButton value="buy" color="success">Buy</ToggleButton>
                <ToggleButton value="sell" color="error">Sell</ToggleButton>
              </ToggleButtonGroup>
              <TextField
                fullWidth
                label="Symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button variant="contained" onClick={handleProceed} fullWidth>
                Proceed
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Save Portfolio
              </Typography>
              <TextField
                fullWidth
                label="Filename (CSV)"
                value={saveFile}
                onChange={(e) => setSaveFile(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button variant="contained" onClick={handleSave} fullWidth>
                Save
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCancel}>
        <DialogTitle>Confirm {action.charAt(0).toUpperCase() + action.slice(1)}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {symbol.toUpperCase()} is currently trading at ${price}. {action === 'buy' ? 'Buy' : 'Sell'} {quantity} shares?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleConfirm} variant="contained" color={action === 'buy' ? 'success' : 'error'}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default App;
