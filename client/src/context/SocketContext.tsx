import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextProps {
  socket: Socket | null;
  joinTask: (taskId: string) => void;
  leaveTask: (taskId: string) => void;
}

const SocketContext = createContext<SocketContextProps>({
  socket: null,
  joinTask: () => {},
  leaveTask: () => {}
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  const joinTask = (taskId: string) => {
    if (socket) {
      socket.emit('join_task', taskId);
    }
  };

  const leaveTask = (taskId: string) => {
    if (socket) {
      socket.emit('leave_task', taskId);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, joinTask, leaveTask }}>
      {children}
    </SocketContext.Provider>
  );
};
