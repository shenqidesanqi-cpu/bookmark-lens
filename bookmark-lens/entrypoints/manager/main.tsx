import React from 'react';
import {createRoot} from 'react-dom/client';
import ManagerApp from '../../components/manager/ManagerApp';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ManagerApp/></React.StrictMode>);
