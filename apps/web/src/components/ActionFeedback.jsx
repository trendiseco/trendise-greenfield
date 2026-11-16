export default function ActionFeedback({error,success,pending}) {
 if(error)return <p className="action-feedback error-box" role="alert"><strong>Error:</strong> {error}</p>;
 if(success)return <p className="action-feedback success-box" role="status"><strong>Success:</strong> {success}</p>;
 if(pending)return <p className="action-feedback notice-box" role="status">{pending}</p>;
 return null;
}
