import React, { useState, useEffect } from 'react';
// NOTE: minor whitespace/comment to trigger reparse by Vite
import { useTheme, useMediaQuery, Stack } from '@mui/material';
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
  Snackbar,
  CircularProgress,
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
  // show login first (landing)
  const [screen, setScreen] = useState('login');
  // auth
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggedInUser, setLoggedInUser] = useState('');
  const [action, setAction] = useState('buy');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saveFile, setSaveFile] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFileUrl, setSavedFileUrl] = useState('');
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Use a dev proxy path so browser requests go through Vite -> backend and avoid CORS/network issues
  const API_BASE = '/api'; // proxied to http://127.0.0.1:8000 by vite.config.js

  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (screen === 'main') {
      // use a small wrapper that calls the API helper
      (async () => {
        const { fetchPortfolioFromApi } = await import('./api');
        const res = await fetchPortfolioFromApi();
        setPortfolio(res.portfolio || []);
        setError(res.error || '');
      })();
    }
    // load stored username
    const u = (async () => {
      try {
        const { getUsername } = await import('./api');
        setLoggedInUser(getUsername());
      } catch (e) {}
    })();
  }, [screen]);

  const handleShowSnackbar = (msg, severity = 'success') => {
    setSnackbarMessage(msg);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  // Format an ISO UTC timestamp string into the user's local timezone in the
  // format: YYYY-MMM-DD HH:mm:ss.SSS (e.g. 2026-FEB-04 20:54:08.234)
  const formatDateLocal = (isoString) => {
    if (!isoString) return '';
    // Ensure 'T' separator and keep microseconds (server gives microseconds +00:00)
    let s = isoString.replace(' ', 'T');
    // If no timezone is present, assume UTC by appending +00:00
    if (!/[Zz]|[+-]\d{2}:?\d{2}$/.test(s)) {
      s = s + '+00:00';
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return isoString;
      const pad = (n, len = 2) => String(n).padStart(len, '0');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const year = d.getFullYear();
    const month = months[d.getMonth()];
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const minute = pad(d.getMinutes());
    const second = pad(d.getSeconds());
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    // timezone offset in minutes (UTC offset)
    const tzOffsetMin = -d.getTimezoneOffset(); // positive for UTC+
    const tzSign = tzOffsetMin >= 0 ? '+' : '-';
    const tzAbs = Math.abs(tzOffsetMin);
    const tzHours = Math.floor(tzAbs / 60);
    const tzMinutes = tzAbs % 60;
    const tzStr = tzMinutes === 0 ? `UTC${tzSign}${tzHours}` : `UTC${tzSign}${tzHours}:${String(tzMinutes).padStart(2,'0')}`;
    return `${year}-${month}-${day} ${hour}:${minute}:${second}.${ms} ${tzStr}`;
  };

  const handleFileLoad = async (event) => { 
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setIsLoadingFile(true);
    try {
      console.log('Uploading portfolio file', file.name);
      const response = await fetch(`${API_BASE}/portfolio/load`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data) {
        setPortfolio(data.portfolio || []);
        setMessage(data.message);
        setError('');
        handleShowSnackbar(data.message || 'Portfolio loaded', 'success');
        setScreen('main');
      } else {
        const detail = data && data.detail ? data.detail : `Server error ${response.status}`;
        setError(detail);
        handleShowSnackbar(detail, 'error');
      }
    } catch (err) {
      console.error('Load error', err);
      setError('Failed to load portfolio');
      handleShowSnackbar('Failed to load portfolio', 'error');
    } finally {
      setIsLoadingFile(false);
    }
  }; 

  const handleNewPortfolio = () => {
    setPortfolio([]);
    setScreen('main');
    setMessage('Started new portfolio');
    handleShowSnackbar('Started new portfolio', 'info');
  };

  const handleProceed = async () => {
    if (!symbol || !quantity) {
      setError('Please enter both symbol and quantity');
      return;
    }
    setIsLoadingPrice(true);
    // Fetch price
    try {
      console.log('Requesting price for', symbol);
      const response = await fetch(`${API_BASE}/get_price?symbol=${symbol.toUpperCase()}`);
      console.log('Price response', response);
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('Price fetch failed:', response.status, errText);
        throw new Error('Failed to fetch price');
      }
      const data = await response.json();
      console.log('Price data', data);
      setPrice(data.price);
      setDialogOpen(true);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch price');
      handleShowSnackbar(err.message || 'Failed to fetch price', 'error');
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleConfirm = async () => {
    setDialogOpen(false);
    setIsSubmittingOrder(true);
    try {
      const endpoint = action === 'buy' ? 'buy' : 'sell';
      const payload = { symbol: symbol.toUpperCase(), quantity: parseInt(quantity) };
      console.log('Submitting', endpoint, payload);
      const { authFetch } = await import('./api');
      const response = await authFetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('Order response', response);
      const data = await response.json().catch((e) => { console.error('Invalid JSON in response', e); return null; });
      console.log('Order data', data);
      if (response.ok && data) {
        setPortfolio(data.portfolio || []);
        setMessage(data.message);
        setError('');
        handleShowSnackbar(data.message || 'Transaction completed', 'success');
        setSymbol('');
        setQuantity('');
        setPrice(null);
      } else if (response.status === 401) {
        const detail = data && data.detail ? data.detail : 'Authentication required';
        setError(detail);
        handleShowSnackbar(detail, 'error');
        // suggest login
        setScreen('load');
      } else {
        const detail = data && data.detail ? data.detail : `Server responded with ${response.status}`;
        console.error('Order error detail:', detail);
        setError(detail);
        handleShowSnackbar(detail, 'error');
      }
    } catch (err) {
      console.error(err);
      setError(`Failed to ${action} stock: ${err.message || err}`);
      handleShowSnackbar(`Failed to ${action} stock: ${err.message || err}`, 'error');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setPrice(null);
  };

  const handleSave = async () => {
    if (!saveFile) {
      setError('Please enter a filename to save');
      handleShowSnackbar('Please enter a filename to save', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const { authFetch } = await import('./api');
      const response = await authFetch(`${API_BASE}/portfolio/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: saveFile }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data) {
        setMessage(data.message);
        setError('');
        const count = data.saved_count || (data.message && data.message.match(/Wrote (\d+) records/)? parseInt(data.message.match(/Wrote (\d+) records/)[1],10) : null);
        if (count !== null) {
          handleShowSnackbar(`${data.message} (${count} records)`, 'success');
        } else {
          handleShowSnackbar(data.message || 'Saved', 'success');
        }
        // build a download URL for the file we just saved (works in dev with proxy)
        setSavedFileUrl(`/api/portfolio/file/${encodeURIComponent(saveFile)}`);
      } else {
        const detail = data && data.detail ? data.detail : `Server error ${response.status}`;
        setError(detail);
        handleShowSnackbar(detail, 'error');
        setSavedFileUrl('');
      }
    } catch (err) {
      console.error('Save error', err);
      setError('Failed to save portfolio');
      handleShowSnackbar('Failed to save portfolio', 'error');
    } finally {
      setIsSaving(false);
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
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileLoad}
                  style={{ display: 'block' }}
                />
                {isLoadingFile && <CircularProgress size={20} sx={{ ml: 2 }} />}
              </div> 
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

  if (screen === 'login') {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Portfolio Management Tool — Login
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Sign in or Register
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth />
              <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={async () => {
                // login
                if (!username || !password) { setError('Enter username and password'); return; }
                const { loginUser } = await import('./api');
                const res = await loginUser(username, password);
                if (!res.ok) { setError(res.error); } else { setError(''); setMessage('Logged in'); setLoggedInUser(username); setScreen('load'); }
              }}>
                Login
              </Button>
              <Button variant="outlined" onClick={async () => {
                // register then auto-login
                if (!username || !password) { setError('Enter username and password'); return; }
                const { registerUser, loginUser } = await import('./api');
                const r = await registerUser(username, password);
                if (!r.ok) { setError(r.error); return; }
                const res = await loginUser(username, password);
                if (!res.ok) { setError(res.error); } else { setError(''); setMessage('Registered and logged in'); setLoggedInUser(username); setScreen('load'); }
              }}>
                Register
              </Button>
            </Box>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
              New users will have a default portfolio created automatically.
            </Typography>
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
              {(!Array.isArray(portfolio) || portfolio.length === 0) ? (
                <Typography>No holdings in portfolio</Typography>
              ) : isSmallScreen ? (
                // Mobile — render each record in a single responsive row
                <Stack spacing={1}>
                  {portfolio.map((row, index) => (
                    <Card key={index} variant="outlined">
                      <CardContent sx={{ px: 1, py: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', flexWrap: 'wrap' }}>
                          <Box sx={{ flex: '0 0 28%', minWidth: 72 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{row.ticker}</Typography>
                          </Box>
                          <Box sx={{ flex: '0 0 20%', minWidth: 60, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Qty {row.quantity}</Typography>
                          </Box>
                          <Box sx={{ flex: '1 0 30%', minWidth: 90, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Cost ${row.totalcost}</Typography>
                          </Box>
                          <Box sx={{ flex: '1 0 40%', minWidth: 120, textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary">{formatDateLocal(row.lasttransactiondate)}</Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              ) : (
                // Desktop/tablet view with horizontal scroll fallback
                <TableContainer component={Paper} sx={{ overflowX: 'auto', maxWidth: '100%' }}>
                  <Table sx={{ width: '100%', tableLayout: 'auto' }}>
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
                          <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.ticker}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.quantity}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>${row.totalcost}</TableCell>
                          <TableCell sx={{ whiteSpace: 'normal' }}>{formatDateLocal(row.lasttransactiondate)}</TableCell>
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
              {loggedInUser ? (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ display: 'inline-block', mr: 1 }}>Signed in as <strong>{loggedInUser}</strong></Typography>
                  <Button size="small" onClick={async () => { const { logoutUser } = await import('./api'); await logoutUser(); setLoggedInUser(''); setMessage('Logged out'); setPortfolio([]); setScreen('login'); }} variant="outlined">Logout</Button>
                </Box>
              ) : (
                <Box sx={{ mb: 2 }}>
                  <Button size="small" variant="outlined" onClick={() => setScreen('login')}>Login / Register</Button>
                </Box>
              )}
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
              <Button variant="contained" onClick={handleProceed} fullWidth disabled={isLoadingPrice || isSubmittingOrder}>
                {isLoadingPrice ? (<><CircularProgress size={18} sx={{ mr: 1 }} />Fetching price...</>) : 'Proceed'}
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
              <Button variant="contained" onClick={handleSave} fullWidth disabled={isSaving}>
                {isSaving ? (<><CircularProgress size={18} sx={{ mr: 1 }} />Saving...</>) : 'Save'}
              </Button>
              {savedFileUrl && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <Button href={savedFileUrl} target="_blank" rel="noopener" size="small">Download saved CSV</Button>
                </Box>
              )}
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
          <Button onClick={handleCancel} disabled={isSubmittingOrder}>Cancel</Button>
          <Button onClick={handleConfirm} variant="contained" color={action === 'buy' ? 'success' : 'error'} disabled={isSubmittingOrder}>
            {isSubmittingOrder ? (<><CircularProgress size={18} sx={{ mr: 1 }} />Processing...</>) : 'Confirm'}
          </Button> 
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App;
