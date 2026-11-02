import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const RegisterPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto redirect to login
    const timer = setTimeout(() => {
      navigate('/login');
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="card max-w-md w-full text-center p-8 border-mudra-border">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-2xl font-bold text-white mb-2">Registration Closed</h1>
        <p className="text-xs text-mudra-muted mb-6 leading-relaxed">
          Public registration is disabled for this tournament. All 200 participants have been assigned pre-generated login credentials.
        </p>
        <Link to="/login" className="btn-primary w-full py-3 font-bold text-sm">
          Go to Competition Login →
        </Link>
        <span className="text-[11px] text-mudra-muted block mt-3">
          Redirecting in 3 seconds...
        </span>
      </div>
    </div>
  );
};

export default RegisterPage;
