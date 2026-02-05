# Portfolio Management Frontend

This is the React frontend for the Portfolio Management Tool, built with Vite and Material-UI. It provides a responsive, professional UI for managing your stock portfolio, including loading/saving portfolios, buying/selling stocks, and displaying holdings.

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

## Installation

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Running the Application

1. Start the development server for frontend (vite) app:
   ```
   npm run dev
   ```
   # for debug mode:  DEBUG=vite:* npm run dev

2. Open your browser and go to `http://localhost:5173`

The app will automatically reload when you make changes to the source code.

## Building for Production

To build the app for production:
```
npm run build
```

The built files will be in the `dist` directory. You can serve them using any static file server.

## Features

- **Responsive Design**: Works seamlessly on mobile and desktop devices
- **Portfolio Management**: View, load, and save portfolios in CSV format
- **Stock Transactions**: Buy and sell stocks with real-time price fetching
- **Professional UI**: Clean, intuitive interface using Material-UI components

## API Integration

This frontend communicates with a FastAPI backend. Ensure the backend is running on `http://localhost:8000` for full functionality. Refer to the backend README for setup instructions.

## Technologies Used

- React 18
- Vite
- Material-UI (@mui/material)
- Emotion (for styling)
