import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './index.css'
import App from './App.jsx'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#007BFF',
      light: '#E3F2FD',
      dark: '#0056B3',
    },
    background: {
      default: '#E3F2FD',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F2542',
    },
  },
  typography: {
    fontFamily: '"Futura", "Trebuchet MS", system-ui, -apple-system, "Segoe UI", sans-serif',
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
