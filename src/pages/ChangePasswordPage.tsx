import { Navigate } from 'react-router-dom';

export function ChangePasswordPage() {
    return <Navigate to="/profile?tab=password" replace />;
}
