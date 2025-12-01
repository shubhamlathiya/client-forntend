import React, { createContext } from "react";
import useNotifications from "../hooks/useNotifications";

export const NotificationContext = createContext(null);

export default function NotificationProvider({ children }) {
    const notif = useNotifications(); // this runs ONLY ONCE

    return (
        <NotificationContext.Provider value={notif}>
            {children}
        </NotificationContext.Provider>
    );
}
