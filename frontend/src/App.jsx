import React, { useState, useEffect, useRef } from 'react';
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
  LinearProgress,
  Skeleton,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Checkbox,
  Switch,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tabs,
  Tab,
} from '@mui/material';
import { styled, useColorScheme } from '@mui/material/styles';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  '&.MuiTableCell-head': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.common.white,
  },
}));

function App() {
  const [portfolio, setPortfolio] = useState([]);
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
  const [advisorAge, setAdvisorAge] = useState('');
  const [advisorRisk, setAdvisorRisk] = useState('Balanced');
  const [advisorAppetite, setAdvisorAppetite] = useState('Medium');
  const [advisorHorizon, setAdvisorHorizon] = useState('Medium');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorElapsed, setAdvisorElapsed] = useState(0);
  const [advisorRecs, setAdvisorRecs] = useState([]);
  const [advisorResponseReceived, setAdvisorResponseReceived] = useState(false);
  const [advisorRawResponse, setAdvisorRawResponse] = useState('');
  const [advisorSelected, setAdvisorSelected] = useState({});
  const [advisorSubmitQueue, setAdvisorSubmitQueue] = useState([]);
  const [advisorSubmitIndex, setAdvisorSubmitIndex] = useState(0);
  const [advisorSubmitActive, setAdvisorSubmitActive] = useState(false);
  const [advisorCompleted, setAdvisorCompleted] = useState({});
  const [advisorInputsCollapsed, setAdvisorInputsCollapsed] = useState(false);
  const [advisorHistory, setAdvisorHistory] = useState([]);
  const [advisorCompareId, setAdvisorCompareId] = useState('');
  const [advisorDrawerOpen, setAdvisorDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Use a dev proxy path so browser requests go through Vite -> backend and avoid CORS/network issues
  const API_BASE = '/api'; // proxied to http://127.0.0.1:8000 by vite.config.js

  const theme = useTheme();
  const { mode, setMode } = useColorScheme();
  const themeHydratedRef = useRef(false);
  const themeUserChangedRef = useRef(false);
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const portfolioCardHeight = isSmallScreen ? '250px' : 'min(60vh, 560px)';
  const currentThemeMode = mode || 'light';

  useEffect(() => {
    let isActive = true;
    void (async () => {
      try {
        const { getThemeMode, fetchPreferences } = await import('./api');
        const stored = getThemeMode();
        if (!isActive || themeUserChangedRef.current) return;
        if (stored) {
          setMode(stored);
          themeHydratedRef.current = true;
          return;
        }
        const prefs = await fetchPreferences();
        if (!isActive || themeUserChangedRef.current) return;
        setMode(prefs.theme_mode || 'light');
        themeHydratedRef.current = true;
      } catch {
        if (!isActive || themeUserChangedRef.current) return;
        setMode('light');
        themeHydratedRef.current = true;
      }
    })();
    return () => {
      isActive = false;
    };
  }, [setMode]);

  const loadAdvisorHistory = async () => {
    try {
      const { fetchAdvisorHistory } = await import('./api');
      const history = await fetchAdvisorHistory();
      if (Array.isArray(history)) {
        setAdvisorHistory(history);
      }
    } catch {
      return;
    }
  };

  useEffect(() => {
    if (screen === 'main' && activeTab === 1) {
      loadAdvisorHistory();
    } else if (activeTab !== 1) {
      setAdvisorDrawerOpen(false);
    }
  }, [screen, activeTab]);

  useEffect(() => {
    if (activeTab === 1 && !advisorResponseReceived) {
      setAdvisorInputsCollapsed(false);
    }
  }, [activeTab, advisorResponseReceived]);

  useEffect(() => {
    if (screen === 'load') {
      setPortfolio([]);
    }
    // load stored username
    void (async () => {
      try {
        const { getUsername } = await import('./api');
        setLoggedInUser(getUsername());
      } catch {
        return;
      }
    })();
  }, [screen]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentThemeMode);
  }, [currentThemeMode]);


  useEffect(() => {
    if (!advisorLoading) {
      setAdvisorElapsed(0);
      return undefined;
    }
    const startedAt = Date.now();
    const intervalId = setInterval(() => {
      setAdvisorElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [advisorLoading]);


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
    } catch {
      if (!merge) setPriceMap({});
    }
  };

  useEffect(() => {
    if (screen !== 'main') return;
    if (!Array.isArray(portfolio) || portfolio.length === 0) return;
    if (Object.keys(priceMap).length > 0) return;
    const symbols = getPortfolioSymbols(portfolio);
    refreshPricesForSymbols(symbols, { merge: false });
  }, [screen, portfolio, priceMap]);

  const handleShowSnackbar = (msg, severity = 'success') => {
    setSnackbarMessage(msg);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };


  const handleThemeToggle = async (nextMode) => {
    themeUserChangedRef.current = true;
    setMode(nextMode);
    try {
      const { updatePreferences, setThemeMode: persistTheme } = await import('./api');
      await updatePreferences({ theme_mode: nextMode });
      persistTheme(nextMode);
    } catch (err) {
      handleShowSnackbar(err.message || 'Failed to save preference', 'error');
    }
  };

  const horizonDurations = {
    Short: '3 to 12 months',
    Medium: '1 to 3 years',
    Long: '3 years and beyond',
  };

  const handleAdvisorGenerateWithGemini = async () => {
    if (!advisorAge || !advisorHorizon) {
      handleShowSnackbar('Please enter age and select investment horizon', 'error');
      return;
    }
    setAdvisorResponseReceived(false);
    setAdvisorRawResponse('');
    setAdvisorElapsed(0);
    setAdvisorLoading(true);
    try {
      const { authFetch } = await import('./api');
      const portfolioCsv = portfolio.length
        ? `symbol,quantity,total_cost,avg_cost\n${portfolio.map((r) => `${r.ticker || r.symbol},"${r.quantity}","${r.totalcost}","${(Number(r.totalcost) / Number(r.quantity)).toFixed(2)}"`).join('\n')}`
        : 'symbol,quantity,total_cost,avg_cost\n(empty portfolio)';

      const prompt = `You are a professional financial advisor specializing in offering solid, non-biased, sector-neutral investment advices based on the age, risk profile, risk appetite, intended investment horizon and the existing portfolio (attached to this prompt) of the user. Your advice should also leverage publicly available market news and trend, giving a slight tilt towards risk adjusted low MER ETFs than individual stocks, avoiding any bespoke options strategies (covered call, protective put etc.). Your suggestion could be a mixture of selling some existing portfolio and buying some suggestive stocks in the view of balancing the potential outcome of the suggestions, in order to meet with the investment horizon, risk appetite, risk profile, age of the user.

User Profile:
- Age: ${advisorAge}
- Risk Profile: ${advisorRisk}
- Risk Appetite: ${advisorAppetite}
- Investment Horizon: ${advisorHorizon} (${horizonDurations[advisorHorizon]})

Existing Portfolio (CSV):
${portfolioCsv}

Confidence should be a number from 0 to 100.

Return ONLY valid JSON with this structure:
{
  "recommendations": [
    {
      "action": "BUY" | "SELL" | "HOLD",
      "symbol": "TICKER",
      "quantity": number,
      "confidence": number,
      "rationale": "brief explanation"
    }
  ]
}`;

      const response = await authFetch(`${API_BASE}/gemini/advise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          profile: {
            age: advisorAge,
            risk_profile: advisorRisk,
            risk_appetite: advisorAppetite,
            horizon: advisorHorizon,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to fetch advisor recommendations');
      }

      const data = await response.json();
      try {
        const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
        const selected = recs.reduce((acc, rec) => {
          const action = String(rec.action || '').toUpperCase();
          if (action === 'BUY' || action === 'SELL') {
            acc[`${rec.symbol}-${rec.action}`] = true;
          }
          return acc;
        }, {});
        const normalizedRecs = recs.map((rec) => ({
          id: `${rec.symbol}-${rec.action}`,
          ...rec,
        }));
        setAdvisorRecs(normalizedRecs);
        setAdvisorSelected(selected);
        setAdvisorCompleted({});
        setAdvisorRawResponse(data.raw_response || '');
        setAdvisorResponseReceived(true);
        if (Array.isArray(data.history)) {
          setAdvisorHistory(data.history);
        } else {
          loadAdvisorHistory();
        }
        if (recs.length === 0 && !data.raw_response) {
          handleShowSnackbar('No recommendations returned', 'info');
        } else {
          handleShowSnackbar('Advisor recommendations loaded', 'success');
        }
      } catch (parseErr) {
        console.error('Parse error:', parseErr);
        handleShowSnackbar('Failed to parse recommendations', 'error');
      }
    } catch (err) {
      console.error('Advisor error:', err);
      handleShowSnackbar(err.message || 'Advisor request failed', 'error');
    } finally {
      setAdvisorLoading(false);
    }
  };
  const handleAdvisorGenerate = () => {
    handleAdvisorGenerateWithGemini();
  };

  const toggleAdvisorSelect = (id) => {
    setAdvisorSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setAdvisorAll = (value, recs) => {
    const next = recs.reduce((acc, rec) => {
      acc[rec.id] = value;
      return acc;
    }, {});
    setAdvisorSelected(next);
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

  const normalizeConfidenceValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return numeric <= 1 ? numeric * 100 : numeric;
  };

  const formatAdvisorTimestamp = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleString();
  };

  const actionableAdvisorRecs = advisorRecs.filter((rec) => {
    const action = String(rec.action || '').toUpperCase();
    return action === 'BUY' || action === 'SELL';
  });
  const showAdvisorResults = !advisorLoading && advisorResponseReceived;
  const selectedAdvisorCount = actionableAdvisorRecs.filter((rec) => advisorSelected[rec.id] && !advisorCompleted[rec.id]).length;
  const safeAdvisorHistory = Array.isArray(advisorHistory) ? advisorHistory : [];
  const advisorCompareRun = safeAdvisorHistory.find((run) => run.id === advisorCompareId) || null;
  const compareMap = advisorCompareRun
    ? (advisorCompareRun.recommendations || []).reduce((acc, rec) => {
      const action = String(rec.action || '').toUpperCase();
      if (action !== 'BUY' && action !== 'SELL') return acc;
      const symbol = String(rec.symbol || '').toUpperCase();
      acc[`${action}::${symbol}`] = rec;
      return acc;
    }, {})
    : {};
  const removedCompareRecs = advisorCompareRun
    ? Object.values(compareMap).filter((rec) => {
      const action = String(rec.action || '').toUpperCase();
      const symbol = String(rec.symbol || '').toUpperCase();
      return !actionableAdvisorRecs.some((cur) => (
        String(cur.action || '').toUpperCase() === action
        && String(cur.symbol || '').toUpperCase() === symbol
      ));
    })
    : [];
  const advisorDrawerAnchor = isSmallScreen ? 'bottom' : 'right';
  const advisorHistoryContent = (
    <Box sx={{ width: isSmallScreen ? '100%' : 360, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1">Recent Advice</Typography>
        {safeAdvisorHistory.length > 0 && (
          <Button
            size="small"
            variant="text"
            onClick={() => setAdvisorCompareId('')}
            sx={{ px: 1, py: 0.25, minWidth: 0 }}
          >
            Clear compare
          </Button>
        )}
      </Box>
      {safeAdvisorHistory.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No recent advice yet.
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          {safeAdvisorHistory.map((run, index) => {
            const runRecs = Array.isArray(run.recommendations) ? run.recommendations : [];
            const buyCount = runRecs.filter((rec) => String(rec.action || '').toUpperCase() === 'BUY').length;
            const sellCount = runRecs.filter((rec) => String(rec.action || '').toUpperCase() === 'SELL').length;
            const averageConfidence = (() => {
              const values = runRecs
                .map((rec) => normalizeConfidenceValue(rec.confidence))
                .filter((value) => value !== null);
              if (!values.length) return null;
              return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
            })();
            return (
              <Button
                key={run.id || index}
                size="small"
                variant={advisorCompareId === run.id ? 'contained' : 'outlined'}
                onClick={() => {
                  setAdvisorCompareId(run.id);
                  setAdvisorDrawerOpen(false);
                }}
                sx={{ justifyContent: 'space-between', textTransform: 'none', px: 1, py: 0.75 }}
              >
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                    {formatAdvisorTimestamp(run.created_at)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Age {run.profile?.age || '—'} · {run.profile?.risk_profile || '—'} · {run.profile?.risk_appetite || '—'} · {run.profile?.horizon || '—'}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
                  BUY {buyCount} / SELL {sellCount}{averageConfidence !== null ? ` · ${averageConfidence}%` : ''}
                </Typography>
              </Button>
            );
          })}
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Select a run to compare. Changes appear in the Change column.
      </Typography>
      {advisorCompareRun && (
        <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            Comparing with {formatAdvisorTimestamp(advisorCompareRun.created_at)}
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              if (!advisorCompareRun.profile) return;
              setAdvisorAge(advisorCompareRun.profile.age || '');
              setAdvisorRisk(advisorCompareRun.profile.risk_profile || 'Balanced');
              setAdvisorAppetite(advisorCompareRun.profile.risk_appetite || 'Medium');
              setAdvisorHorizon(advisorCompareRun.profile.horizon || 'Medium');
            }}
            sx={{ px: 1, py: 0.25, minWidth: 0 }}
          >
            Use profile again
          </Button>
        </Box>
      )}
    </Box>
  );

  useEffect(() => {
    if (showAdvisorResults) {
      setAdvisorInputsCollapsed(true);
    }
  }, [showAdvisorResults]);

  const getHoldingQuantity = (recSymbol) => {
    const target = String(recSymbol || '').trim().toUpperCase();
    if (!target) return 0;
    const total = portfolio.reduce((sum, row) => {
      const symbolValue = String(row.ticker || row.symbol || '').trim().toUpperCase();
      if (symbolValue !== target) return sum;
      const qty = Number(row.quantity);
      return sum + (Number.isFinite(qty) ? qty : 0);
    }, 0);
    return total;
  };

  const formatConfidencePercent = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    const percent = numeric <= 1 ? numeric * 100 : numeric;
    return `${Math.round(percent)}%`;
  };


  const currentAdvisorRec = advisorSubmitQueue[advisorSubmitIndex];
  const advisorSubmitProgress = advisorSubmitQueue.length > 0
    ? Math.round(((advisorSubmitIndex + 1) / advisorSubmitQueue.length) * 100)
    : 0;

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
    try {
      const { authFetch } = await import('./api');
      const response = await authFetch(`${API_BASE}/portfolio/reset`, { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (response.ok) {
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
    } catch {
      setError('');
      setScreen('main');
    }
  };

  const fetchPriceForOrder = async ({ nextAction, nextSymbol, nextQuantity }) => {
    if (!nextSymbol || !nextQuantity) {
      setError('Please enter both symbol and quantity');
      return false;
    }
    setIsLoadingPrice(true);
    // Fetch price
    try {
      console.log('Requesting price for', nextSymbol);
      const response = await fetch(`${API_BASE}/get_price?symbol=${nextSymbol.toUpperCase()}`);
      console.log('Price response', response);
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('Price fetch failed:', response.status, errText);
        throw new Error('Failed to fetch price');
      }
      const data = await response.json();
      console.log('Price data', data);
      setAction(nextAction);
      setSymbol(nextSymbol);
      setQuantity(nextQuantity);
      setPrice(data.price);
      setDialogOpen(true);
      setError('');
      return true;
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch price');
      handleShowSnackbar(err.message || 'Failed to fetch price', 'error');
      return false;
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleProceed = async () => {
    await fetchPriceForOrder({
      nextAction: action,
      nextSymbol: symbol,
      nextQuantity: quantity,
    });
  };

  const openAdvisorRecommendation = async (rec) => {
    if (!rec) return;
    const nextAction = String(rec.action || '').toLowerCase() === 'sell' ? 'sell' : 'buy';
    const nextSymbol = String(rec.symbol || '').trim().toUpperCase();
    const nextQuantity = String(rec.quantity ?? '').trim();
    const ok = await fetchPriceForOrder({ nextAction, nextSymbol, nextQuantity });
    if (!ok) {
      setAdvisorSubmitActive(false);
      setAdvisorSubmitQueue([]);
      setAdvisorSubmitIndex(0);
    }
  };

  const finishAdvisorSubmit = () => {
    setAdvisorSubmitActive(false);
    setAdvisorSubmitQueue([]);
    setAdvisorSubmitIndex(0);
    setActiveTab(0);
    handleShowSnackbar('Advisor actions complete', 'success');
  };

  const advanceAdvisorSubmit = () => {
    const nextIndex = advisorSubmitIndex + 1;
    if (nextIndex >= advisorSubmitQueue.length) {
      finishAdvisorSubmit();
      return;
    }
    setAdvisorSubmitIndex(nextIndex);
    void openAdvisorRecommendation(advisorSubmitQueue[nextIndex]);
  };

  const handleAdvisorSubmit = () => {
    const queue = actionableAdvisorRecs.filter((rec) => advisorSelected[rec.id]);
    if (queue.length === 0) return;
    setAdvisorSubmitQueue(queue);
    setAdvisorSubmitIndex(0);
    setAdvisorSubmitActive(true);
    void openAdvisorRecommendation(queue[0]);
  };

  const handleAdvisorSkip = () => {
    setDialogOpen(false);
    setPrice(null);
    advanceAdvisorSubmit();
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
        setError('');
        handleShowSnackbar(data.message || 'Transaction completed', 'success');
        setSymbol('');
        setQuantity('');
        setPrice(null);
        if (advisorSubmitActive) {
          const completedRec = advisorSubmitQueue[advisorSubmitIndex];
          if (completedRec) {
            setAdvisorCompleted((prev) => ({ ...prev, [completedRec.id]: true }));
            setAdvisorSelected((prev) => ({ ...prev, [completedRec.id]: false }));
          }
          advanceAdvisorSubmit();
        }
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
    if (advisorSubmitActive) {
      setAdvisorSubmitActive(false);
      setAdvisorSubmitQueue([]);
      setAdvisorSubmitIndex(0);
    }
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
    setMode('light');
    setLoggedInUser('');
    setPortfolio([]);
    setPriceMap({});
    setError('');
    setSavedFileUrl('');
    setSaveFile('');
    setSymbol('');
    setQuantity('');
    setPrice(null);
    setAdvisorHistory([]);
    setAdvisorCompareId('');
    setScreen('login');
  };

  if (screen === 'load') {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box component="img" src={logoShort} alt="Tyche TPM" sx={{ height: 34, maxWidth: '45%' }} />
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
          <Box
            component="img"
            src={logoLong}
            alt="Tyche TPM"
            sx={{ width: 'min(410px, 90vw)', height: 'auto', maxWidth: '100%', objectFit: 'contain' }}
          />
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
                if (!res.ok) {
                  setError(res.error);
                } else {
                  if (res.theme_mode) setMode(res.theme_mode);
                  setError('');
                  setLoggedInUser(username);
                  setPortfolio([]);
                  setSavedFileUrl('');
                  setSaveFile('');
                  setSymbol('');
                  setQuantity('');
                  setPrice(null);
                  setScreen('load');
                }
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
                if (!res.ok) {
                  setError(res.error);
                } else {
                  if (res.theme_mode) setMode(res.theme_mode);
                  setError('');
                  setLoggedInUser(username);
                  setPortfolio([]);
                  setSavedFileUrl('');
                  setSaveFile('');
                  setSymbol('');
                  setQuantity('');
                  setPrice(null);
                  setScreen('load');
                }
              }}>
                Register
              </Button>
            </Box>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
              New users will have a default portfolio created automatically.
            </Typography>
          </CardContent>
        </Card>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 0.5, mb: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Box component="img" src={logoShort} alt="Tyche TPM" sx={{ height: 34, maxWidth: '35%' }} />
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
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        sx={{ mb: 1.5 }}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        <Tab label={isSmallScreen ? 'Portfolio' : 'My Portfolio'} />
        <Tab label={isSmallScreen ? 'Advisor' : 'Tyche AI Advisor'} />
        <Tab label={isSmallScreen ? 'Prefs' : 'Preference'} />
      </Tabs>

      {activeTab === 0 && (
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
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25 }}>
                                    {pnl !== null && pnl !== 0 && (
                                      pnl > 0 ? (
                                        <ArrowDropUpIcon sx={{ fontSize: '1rem', color: 'success.main' }} />
                                      ) : (
                                        <ArrowDropDownIcon sx={{ fontSize: '1rem', color: 'error.main' }} />
                                      )
                                    )}
                                    <Typography sx={{ fontSize: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap', color: pnlColor }}>
                                      {pnlText}
                                    </Typography>
                                  </Box>
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
                                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                                    {pnl !== null && pnl !== 0 && (
                                      pnl > 0 ? (
                                        <ArrowDropUpIcon sx={{ fontSize: '1rem', color: 'success.main' }} />
                                      ) : (
                                        <ArrowDropDownIcon sx={{ fontSize: '1rem', color: 'error.main' }} />
                                      )
                                    )}
                                    <Typography component="span" sx={{ fontSize: '0.75rem', color: pnlColor }}>
                                      {pnlText}
                                    </Typography>
                                  </Box>
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
      )}


      {activeTab === 1 && (
        <Card>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant={isSmallScreen ? 'h6' : 'h5'} gutterBottom>
              Tyche AI Advisor
            </Typography>
            <Grid container spacing={1.5}>
              {!advisorInputsCollapsed && (
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Age"
                    type="number"
                    size="small"
                    fullWidth
                    value={advisorAge}
                    onChange={(e) => setAdvisorAge(e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Risk Profile</InputLabel>
                    <Select value={advisorRisk} label="Risk Profile" onChange={(e) => setAdvisorRisk(e.target.value)}>
                      <MenuItem value="Conservative">Conservative</MenuItem>
                      <MenuItem value="Balanced">Balanced</MenuItem>
                      <MenuItem value="Aggressive">Aggressive</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Risk Appetite</InputLabel>
                    <Select value={advisorAppetite} label="Risk Appetite" onChange={(e) => setAdvisorAppetite(e.target.value)}>
                      <MenuItem value="Low">Low</MenuItem>
                      <MenuItem value="Medium">Medium</MenuItem>
                      <MenuItem value="High">High</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Horizon</InputLabel>
                    <Select value={advisorHorizon} label="Horizon" onChange={(e) => setAdvisorHorizon(e.target.value)}>
                      <MenuItem value="Short">Short</MenuItem>
                      <MenuItem value="Medium">Medium</MenuItem>
                      <MenuItem value="Long">Long</MenuItem>
                    </Select>
                  </FormControl>
                  <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleAdvisorGenerate}
                      disabled={advisorLoading}
                    >
                      {advisorLoading ? (
                        <>
                          <CircularProgress size={16} sx={{ mr: 1 }} />Analyzing
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {advisorElapsed}s
                          </Typography>
                        </>
                      ) : 'Ask Tyche AI Advisor'}
                    </Button>
                    {(showAdvisorResults || advisorInputsCollapsed) && (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => setAdvisorInputsCollapsed(true)}
                        sx={{ px: 1, py: 0.25, minWidth: 0 }}
                      >
                        Collapse inputs
                      </Button>
                    )}
                  </Box>
                </Grid>
              )}
              {advisorInputsCollapsed && (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary">
                      Profile: {advisorAge || '—'} · {advisorRisk} · {advisorAppetite} · {advisorHorizon}
                    </Typography>
                    {showAdvisorResults && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" variant="text" onClick={() => setAdvisorInputsCollapsed(false)} sx={{ px: 1, py: 0.25, minWidth: 0 }}>
                          Expand inputs
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Grid>
              )}
              {showAdvisorResults && (
                <>
                  <Grid size={{ xs: 12, md: advisorInputsCollapsed ? 7 : 4 }}>
                    <Typography variant={isSmallScreen ? 'h6' : 'h5'} gutterBottom>
                      Recommendations
                    </Typography>
                    {actionableAdvisorRecs.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                        <Button size="small" variant="text" onClick={() => setAdvisorAll(true, actionableAdvisorRecs)} sx={{ px: 1, py: 0.25, minWidth: 0 }}>
                          Select all
                        </Button>
                        <Button size="small" variant="text" onClick={() => setAdvisorAll(false, actionableAdvisorRecs)} sx={{ px: 1, py: 0.25, minWidth: 0 }}>
                          Clear
                        </Button>
                      </Box>
                    )}
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 260, overflowY: 'auto' }}>
                      <Table size="small" stickyHeader sx={{ tableLayout: 'fixed' }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontSize: '0.7rem', py: 0.5, width: '24%' }}>Buy/Sell</TableCell>
                            <TableCell sx={{ fontSize: '0.7rem', py: 0.5, width: '16%' }}>Ticker</TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.7rem', py: 0.5, width: '20%' }}>Rec Qty</TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.7rem', py: 0.5, width: '20%' }}>Held Qty</TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.7rem', py: 0.5, width: '20%' }}>Conf %</TableCell>
                            <TableCell sx={{ fontSize: '0.7rem', py: 0.5, width: '20%' }}>Change</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {actionableAdvisorRecs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} sx={{ py: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  No BUY/SELL recommendations returned yet.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            actionableAdvisorRecs.map((rec) => (
                              (() => {
                                const isCompleted = !!advisorCompleted[rec.id];
                                const compareKey = `${String(rec.action || '').toUpperCase()}::${String(rec.symbol || '').toUpperCase()}`;
                                const compareRec = compareMap[compareKey];
                                let changeLabel = '';
                                if (advisorCompareRun) {
                                  if (!compareRec) {
                                    changeLabel = 'NEW';
                                  } else {
                                    const qtyDelta = Number(rec.quantity) - Number(compareRec.quantity);
                                    const confDelta = (normalizeConfidenceValue(rec.confidence) ?? 0) - (normalizeConfidenceValue(compareRec.confidence) ?? 0);
                                    const parts = [];
                                    if (Number.isFinite(qtyDelta) && qtyDelta !== 0) {
                                      parts.push(`Qty ${qtyDelta > 0 ? '+' : ''}${qtyDelta}`);
                                    }
                                    if (Number.isFinite(confDelta) && Math.round(confDelta) !== 0) {
                                      parts.push(`Conf ${confDelta > 0 ? '+' : ''}${Math.round(confDelta)}%`);
                                    }
                                    changeLabel = parts.length ? parts.join(' ') : 'Same';
                                  }
                                }
                                return (
                              <TableRow key={rec.id}>
                                <TableCell sx={{ py: 0.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Checkbox
                                      size="small"
                                      checked={!!advisorSelected[rec.id]}
                                      onChange={() => toggleAdvisorSelect(rec.id)}
                                      sx={{ p: 0.25 }}
                                      disabled={isCompleted}
                                    />
                                    <Typography
                                      variant="body2"
                                      sx={{ fontSize: '0.78rem', color: isCompleted ? 'text.disabled' : 'text.primary' }}
                                    >
                                      {rec.action}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell sx={{ py: 0.5, fontSize: '0.78rem', color: isCompleted ? 'text.disabled' : 'text.primary' }}>
                                  {String(rec.symbol || '').toUpperCase()}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.5, fontSize: '0.78rem', color: isCompleted ? 'text.disabled' : 'text.primary' }}>
                                  {rec.quantity ?? '—'}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.5, fontSize: '0.78rem', color: isCompleted ? 'text.disabled' : 'text.primary' }}>
                                  {formatQuantity(getHoldingQuantity(rec.symbol))}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.5, fontSize: '0.78rem', color: isCompleted ? 'text.disabled' : 'text.primary' }}>
                                  {formatConfidencePercent(rec.confidence)}
                                </TableCell>
                                <TableCell sx={{ py: 0.5, fontSize: '0.72rem', color: isCompleted ? 'text.disabled' : 'text.secondary' }}>
                                  {changeLabel || '—'}
                                </TableCell>
                              </TableRow>
                                );
                              })()
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {advisorCompareRun && removedCompareRecs.length > 0 && (
                      <Box sx={{ mt: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Removed since last advice:
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {removedCompareRecs.map((rec) => `${String(rec.action || '').toUpperCase()} ${String(rec.symbol || '').toUpperCase()}`).join(' · ')}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="text.secondary">
                        Selected: {selectedAdvisorCount}
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={handleAdvisorSubmit}
                        disabled={selectedAdvisorCount === 0 || advisorSubmitActive}
                      >
                        Submit
                      </Button>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: advisorInputsCollapsed ? 5 : 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant={isSmallScreen ? 'h6' : 'h5'}>
                        Your Tyche's Advice
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setAdvisorDrawerOpen(true)}
                        >
                          Recent Advice
                        </Button>
                        {advisorCompareRun && (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => setAdvisorCompareId('')}
                            sx={{ px: 1, py: 0.25, minWidth: 0 }}
                          >
                            Clear compare
                          </Button>
                        )}
                      </Box>
                    </Box>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 0.75,
                        height: isSmallScreen ? 240 : 320,
                        overflowY: 'auto',
                        backgroundColor: 'var(--soft-bg)',
                      }}
                    >
                      {advisorRecs.length === 0 ? (
                        <Box sx={{ p: 1, borderRadius: 1, border: '1px dashed', borderColor: 'divider' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: advisorRawResponse ? 0.75 : 0 }}>
                            No recommendations to display yet.
                          </Typography>
                          {advisorRawResponse && (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                              {advisorRawResponse}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        advisorRecs.map((rec) => {
                          const action = (rec.action || '').toUpperCase();
                          const actionColor = action === 'BUY'
                            ? 'success.main'
                            : action === 'SELL'
                              ? 'error.main'
                              : 'text.secondary';
                          const symbol = (rec.symbol || '').toUpperCase();
                          return (
                            <Box
                              key={rec.id}
                              sx={{
                                mb: 1,
                                p: 1,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                backgroundColor: 'var(--card-bg)',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="subtitle2">{symbol || '—'}</Typography>
                                <Typography variant="caption" sx={{ fontWeight: 600, color: actionColor }}>
                                  {action || 'HOLD'}
                                </Typography>
                              </Box>
                              <Box sx={{ mt: 0.75, p: 0.75, borderRadius: 1, backgroundColor: 'var(--soft-bg-alt)' }}>
                                <Typography variant="body2">
                                  {rec.rationale || 'No reasoning provided.'}
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })
                      )}
                    </Paper>
                  </Grid>
                </>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {activeTab === 2 && (
        <Card>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant={isSmallScreen ? 'h6' : 'h5'} gutterBottom>
              Preference
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Choose a display mode. Changes are saved automatically.
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">Light</Typography>
              <Switch
                checked={currentThemeMode === 'dark'}
                onChange={(event) => handleThemeToggle(event.target.checked ? 'dark' : 'light')}
                inputProps={{ 'aria-label': 'Toggle dark mode' }}
              />
              <Typography variant="body2">Dark</Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      <Drawer
        anchor={advisorDrawerAnchor}
        open={advisorDrawerOpen}
        onClose={() => setAdvisorDrawerOpen(false)}
      >
        {advisorHistoryContent}
      </Drawer>

      <Dialog open={dialogOpen} onClose={handleCancel}>
        <DialogTitle>Confirm {action.charAt(0).toUpperCase() + action.slice(1)}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {advisorSubmitActive && advisorSubmitQueue.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Advisor recommendation {advisorSubmitIndex + 1} of {advisorSubmitQueue.length}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Processing {String(currentAdvisorRec?.action || '').toUpperCase()} {String(currentAdvisorRec?.symbol || '').toUpperCase()} x{currentAdvisorRec?.quantity ?? '—'}
                </Typography>
                <LinearProgress variant="determinate" value={advisorSubmitProgress} />
              </Box>
            )}
            {symbol.toUpperCase()} is currently trading at ${price}. {action === 'buy' ? 'Buy' : 'Sell'} {quantity} shares?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          {advisorSubmitActive && (
            <Button onClick={handleAdvisorSkip} disabled={isSubmittingOrder}>Skip</Button>
          )}
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
