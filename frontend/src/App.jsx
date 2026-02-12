import React, { useState, useEffect } from 'react';
import logoLong from '../img/Tyche TPM Long Logo.jpeg';
import logoShort from '../img/Tyche TPM Small Logo.jpeg';
// NOTE: minor whitespace/comment to trigger reparse by Vite
import { useTheme, useMediaQuery, Stack } from '@mui/material';
import Grid from '@mui/material/Grid';
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
  const [priceMap, setPriceMap] = useState({});

  // Use a dev proxy path so browser requests go through Vite -> backend and avoid CORS/network issues
  const API_BASE = '/api'; // proxied to http://127.0.0.1:8000 by vite.config.js

  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isMediumDown = useMediaQuery(theme.breakpoints.down('md'));
  const portfolioMaxHeight = isSmallScreen
    ? '45vh'
    : isMediumDown
      ? 'min(46vh, 420px)'
      : 'min(52vh, 520px)';
  const portfolioCardHeight = isSmallScreen ? '250px' : 'min(60vh, 560px)';

  useEffect(() => {
    if (screen === 'load') {
      setPortfolio([]);
    }
    // load stored username
    const u = (async () => {
      try {
        const { getUsername } = await import('./api');
        setLoggedInUser(getUsername());
      } catch (e) {}
    })();
  }, [screen]);

  const getPortfolioSymbols = (rows) => Array.from(
    new Set(
      (rows || [])
        .map((row) => (row.ticker || row.symbol || '').trim().toUpperCase())
        .filter((value) => value)
    )
  );

  const refreshPricesForSymbols = async (symbols, { merge = false } = {}) => {
    if (!symbols || symbols.length === 0) {
      if (!merge) setPriceMap({});
      return;
    }
    try {
      const responses = await Promise.all(
        symbols.map(async (ticker) => {
          const response = await fetch(`${API_BASE}/get_price?symbol=${ticker}`);
          if (!response.ok) return [ticker, null];
          const data = await response.json().catch(() => null);
          const numeric = data && Number(data.price);
          return [ticker, Number.isFinite(numeric) ? numeric : null];
        })
      );
      const nextMap = responses.reduce((acc, [ticker, value]) => {
        acc[ticker] = value;
        return acc;
      }, {});
      setPriceMap((prev) => (merge ? { ...prev, ...nextMap } : nextMap));
    } catch (err) {
      if (!merge) setPriceMap({});
    }
  };

  useEffect(() => {
    if (screen !== 'main') return;
    if (!Array.isArray(portfolio) || portfolio.length === 0) return;
    if (Object.keys(priceMap).length > 0) return;
    const symbols = getPortfolioSymbols(portfolio);
    refreshPricesForSymbols(symbols, { merge: false });
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

  const formatQuantity = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    return numeric.toFixed(1);
  };

  const formatCurrency = (value, digits = 2) => {
    if (!Number.isFinite(value)) return '';
    return value.toFixed(digits);
  };

  const normalizePortfolioRows = (rows) => {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const ticker = row.ticker || row.symbol || '';
      const quantityValue = row.quantity !== undefined ? row.quantity : '';
      const avgCostValue = row.avgcost !== undefined ? row.avgcost : row.avgCost;
      const totalCostRaw = row.totalcost !== undefined ? row.totalcost : null;
      const numericQty = Number(quantityValue);
      const numericAvg = Number(avgCostValue);
      let totalcost = '';
      if (totalCostRaw !== null && totalCostRaw !== undefined && totalCostRaw !== '') {
        const numericTotal = Number(totalCostRaw);
        totalcost = Number.isFinite(numericTotal) ? numericTotal.toFixed(2) : String(totalCostRaw);
      } else if (Number.isFinite(numericQty) && Number.isFinite(numericAvg)) {
        totalcost = (numericQty * numericAvg).toFixed(2);
      }
      return {
        ...row,
        ticker,
        quantity: quantityValue,
        totalcost,
      };
    });
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

  const formatDateUtcShort = (isoString) => {
    if (!isoString) return '';
    let s = isoString.replace(' ', 'T');
    if (!/[Zz]|[+-]\d{2}:?\d{2}$/.test(s)) {
      s = s + '+00:00';
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return isoString;
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const day = pad(d.getUTCDate());
    const month = months[d.getUTCMonth()];
    const year = String(d.getUTCFullYear()).slice(-2);
    const hour = pad(d.getUTCHours());
    const minute = pad(d.getUTCMinutes());
    const second = pad(d.getUTCSeconds());
    return `${day}-${month}-${year} ${hour}:${minute}:${second} UTC`;
  };

  const formatDateLocalCompact = (isoString) => formatDateUtcShort(isoString);

  const handleFileLoad = async (event) => { 
    const file = event.target.files[0];
    if (!file) return;
    setPortfolio([]);
    const formData = new FormData();
    formData.append('file', file);
    setIsLoadingFile(true);
    try {
      console.log('Uploading portfolio file', file.name);
      const { authFetch } = await import('./api');
      const response = await authFetch(`${API_BASE}/portfolio/load`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data) {
        const nextPortfolio = normalizePortfolioRows(data.portfolio || []);
        setPortfolio(nextPortfolio);
        refreshPricesForSymbols(getPortfolioSymbols(nextPortfolio), { merge: false });
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

  const handleNewPortfolio = async () => {
    setPortfolio([]);
    setPriceMap({});
    setSavedFileUrl('');
    setSaveFile('');
    setSymbol('');
    setQuantity('');
    setPrice(null);
    setError('');
    setMessage('');
    try {
      const { authFetch } = await import('./api');
      const response = await authFetch(`${API_BASE}/portfolio/reset`, { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (response.ok) {
        setMessage(data && data.message ? data.message : 'Started new portfolio');
        handleShowSnackbar(data && data.message ? data.message : 'Started new portfolio', 'info');
        setScreen('main');
      } else {
        const detail = data && data.detail ? data.detail : `Server error ${response.status}`;
        if (response.status === 401) {
          setError(detail);
          handleShowSnackbar(detail, 'error');
        } else {
          setError('');
        }
        setScreen('main');
      }
    } catch (err) {
      setError('');
      setScreen('main');
    }
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
        const nextPortfolio = normalizePortfolioRows(data.portfolio || []);
        setPortfolio(nextPortfolio);
        const refreshSymbol = symbol.trim().toUpperCase();
        if (refreshSymbol) {
          refreshPricesForSymbols([refreshSymbol], { merge: true });
        }
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
    if (!Array.isArray(portfolio) || portfolio.length === 0) {
      setError('No holdings to save');
      handleShowSnackbar('No holdings to save', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const safeName = saveFile.toLowerCase().endsWith('.csv') ? saveFile : `${saveFile}.csv`;
      const headers = ['symbol', 'quantity', 'avgcost', 'curprice', 'lasttransactiondate'];
      const rows = portfolio.map((row) => {
        const symbol = row.symbol || row.ticker || '';
        const quantity = row.quantity ?? '';
        const avgcost = row.avgcost ?? '';
        const curprice = row.curprice ?? '';
        const lasttransactiondate = row.lasttransactiondate ?? '';
        return [symbol, quantity, avgcost, curprice, lasttransactiondate];
      });
      const csvLines = [headers.join(',')].concat(
        rows.map((cols) => cols.map((value) => {
          const text = String(value ?? '');
          if (text.includes('"')) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          if (text.includes(',') || text.includes('\n')) {
            return `"${text}"`;
          }
          return text;
        }).join(','))
      );
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = safeName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`Prepared ${safeName}`);
      setError('');
      handleShowSnackbar('Download started', 'success');
      setSavedFileUrl('');
    } catch (err) {
      console.error('Save error', err);
      setError('Failed to save portfolio');
      handleShowSnackbar('Failed to save portfolio', 'error');
    } finally {
      setIsSaving(false);
    }
  }; 

  const handleLogout = async () => {
    const { logoutUser } = await import('./api');
    await logoutUser();
    setLoggedInUser('');
    setPortfolio([]);
    setPriceMap({});
    setMessage('Logged out');
    setError('');
    setSavedFileUrl('');
    setSaveFile('');
    setSymbol('');
    setQuantity('');
    setPrice(null);
    setScreen('login');
  };

  if (screen === 'load') {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box component="img" src={logoShort} alt="Tyche TPM" sx={{ height: 28, maxWidth: '45%' }} />
          {loggedInUser ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">Signed in as <strong>{loggedInUser}</strong></Typography>
              <Button size="small" variant="outlined" onClick={handleLogout} sx={{ minWidth: 64, px: 1.25 }}>
                Logout
              </Button>
            </Box>
          ) : (
            <Button size="small" variant="outlined" onClick={() => setScreen('login')}>Login / Register</Button>
          )}
        </Box>
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

  const getUnrealized = (row) => {
    const ticker = (row.ticker || row.symbol || '').trim().toUpperCase();
    const currentPrice = priceMap[ticker];
    const numericQty = Number(row.quantity);
    const numericTotal = Number(row.totalcost);
    if (!Number.isFinite(currentPrice) || !Number.isFinite(numericQty) || !Number.isFinite(numericTotal) || numericQty === 0) {
      return null;
    }
    const avgCost = numericTotal / numericQty;
    return (currentPrice - avgCost) * numericQty;
  };

  if (screen === 'login') {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box component="img" src={logoLong} alt="Tyche TPM" sx={{ height: 56, maxWidth: '100%', objectFit: 'contain' }} />
        </Box>
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
                if (!res.ok) { setError(res.error); } else { setError(''); setMessage('Logged in'); setLoggedInUser(username); setPortfolio([]); setSavedFileUrl(''); setSaveFile(''); setSymbol(''); setQuantity(''); setPrice(null); setScreen('load'); }
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
                if (!res.ok) { setError(res.error); } else { setError(''); setMessage('Registered and logged in'); setLoggedInUser(username); setPortfolio([]); setSavedFileUrl(''); setSaveFile(''); setSymbol(''); setQuantity(''); setPrice(null); setScreen('load'); }
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
    <Container maxWidth="lg" sx={{ mt: 0.5, mb: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Box component="img" src={logoShort} alt="Tyche TPM" sx={{ height: 28, maxWidth: '35%' }} />
        {loggedInUser ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Signed in as <strong>{loggedInUser}</strong></Typography>
            <Button size="small" variant="outlined" onClick={handleLogout} sx={{ minWidth: 64, px: 1.25 }}>
              Logout
            </Button>
          </Box>
        ) : (
          <Button size="small" variant="outlined" onClick={() => setScreen('login')}>Login / Register</Button>
        )}
      </Box>
      {message && <Alert severity="success" sx={{ mb: 1 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      <Grid container spacing={1.5} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 7 }} order={{ xs: 1, md: 1 }}>
          <Card sx={{ height: portfolioCardHeight, maxHeight: portfolioCardHeight, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <CardContent sx={{ py: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', '&:last-child': { pb: 1 } }}>
              <Typography variant={isSmallScreen ? 'h6' : 'h5'} gutterBottom>
                Current Portfolio
              </Typography>
              {(!Array.isArray(portfolio) || portfolio.length === 0) ? (
                <Typography>No holdings in portfolio</Typography>
              ) : isSmallScreen ? (
                // Mobile — render each record in a single responsive row
                <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.25 }}>
                  <Stack spacing={0.75} sx={{ minHeight: 0 }}>
                    {portfolio.map((row, index) => (
                      <Card key={index} variant="outlined">
                        <CardContent sx={{ px: 0.75, py: 0.6, '&:last-child': { pb: 0.6 } }}>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: '0.9fr 0.9fr 1fr 1fr 1.8fr',
                              columnGap: 0.4,
                              alignItems: 'center',
                              width: '100%',
                            }}
                          >
                            <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>
                              {row.ticker}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap', pl: 0.25 }}>
                              {formatQuantity(row.quantity)}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap', pl: 0.25 }}>
                              ${row.totalcost}
                            </Typography>
                            {(() => {
                              const pnl = getUnrealized(row);
                              const pnlColor = pnl === null ? 'text.secondary' : pnl >= 0 ? 'success.main' : 'error.main';
                              const pnlText = pnl === null ? '—' : formatCurrency(pnl);
                              return (
                                <Typography sx={{ fontSize: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap', pl: 0.25, color: pnlColor }}>
                                  {pnlText}
                                </Typography>
                              );
                            })()}
                            <Typography sx={{ fontSize: '0.64rem', color: 'text.secondary', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pl: 0.25 }}>
                              {formatDateLocalCompact(row.lasttransactiondate)}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              ) : (
                // Desktop/tablet view with horizontal scroll fallback
                <TableContainer component={Paper} sx={{ overflowX: 'auto', maxWidth: '100%', flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <Table size="small" sx={{ width: '100%', tableLayout: 'auto' }}>
                    <TableHead>
                      <TableRow>
                        <StyledTableCell>Ticker</StyledTableCell>
                        <StyledTableCell align="right">Quantity</StyledTableCell>
                        <StyledTableCell align="right">Total Cost</StyledTableCell>
                        <StyledTableCell align="right">Unrealized P/L</StyledTableCell>
                        <StyledTableCell>Last Transaction Date</StyledTableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {portfolio.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word', py: 0.75 }}>{row.ticker}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', py: 0.75 }}>{formatQuantity(row.quantity)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', py: 0.75 }}>${row.totalcost}</TableCell>
                          {(() => {
                            const pnl = getUnrealized(row);
                            const pnlColor = pnl === null ? 'text.secondary' : pnl >= 0 ? 'success.main' : 'error.main';
                            const pnlText = pnl === null ? '—' : formatCurrency(pnl);
                            return (
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap', py: 0.75, color: pnlColor }}>
                                {pnlText}
                              </TableCell>
                            );
                          })()}
                          <TableCell sx={{ whiteSpace: 'nowrap', py: 0.75, fontSize: '0.75rem' }}>
                            {formatDateUtcShort(row.lasttransactiondate)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }} order={{ xs: 2, md: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Card>
              <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                <Typography variant={isSmallScreen ? 'h6' : 'h5'} gutterBottom>
                  Buy / Sell Stock
                </Typography>
                <ToggleButtonGroup
                  value={action}
                  exclusive
                  onChange={(e, newAction) => newAction && setAction(newAction)}
                  size="small"
                  sx={{ mb: 0.75 }}
                >
                  <ToggleButton value="buy" color="success">Buy</ToggleButton>
                  <ToggleButton value="sell" color="error">Sell</ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  fullWidth
                  size="small"
                  label="Symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  sx={{ mb: 0.75 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  sx={{ mb: 0.75 }}
                />
                <Button size="small" variant="contained" onClick={handleProceed} fullWidth disabled={isLoadingPrice || isSubmittingOrder}>
                  {isLoadingPrice ? (<><CircularProgress size={18} sx={{ mr: 1 }} />Fetching price...</>) : 'Proceed'}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                <Typography variant={isSmallScreen ? 'h6' : 'h5'} gutterBottom>
                  Save Portfolio
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  label="Filename (CSV)"
                  value={saveFile}
                  onChange={(e) => setSaveFile(e.target.value)}
                  sx={{ mb: 0.75 }}
                />
                <Button size="small" variant="contained" onClick={handleSave} fullWidth disabled={isSaving}>
                  {isSaving ? (<><CircularProgress size={18} sx={{ mr: 1 }} />Saving...</>) : 'Save'}
                </Button>
                {savedFileUrl && (
                  <Box sx={{ mt: 1, textAlign: 'center' }}>
                    <Button href={savedFileUrl} target="_blank" rel="noopener" size="small">Download saved CSV</Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
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
