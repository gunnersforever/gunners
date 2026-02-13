import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssVarsProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './index.css'
import App from './App.jsx'

const theme = createTheme({
  colorSchemes: {
    light: {
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
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: {
          main: '#5AB0FF',
          light: '#0F2542',
          dark: '#1D6FB8',
        },
        background: {
          default: '#0B1726',
          paper: '#111F33',
        },
        text: {
          primary: '#E3F2FD',
        },
      },
    },
  },
  typography: {
    fontFamily: '"Futura", "Trebuchet MS", system-ui, -apple-system, "Segoe UI", sans-serif',
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CssVarsProvider theme={theme} defaultMode="light">
      <CssBaseline />
      <App />
    </CssVarsProvider>
  </StrictMode>,
)
