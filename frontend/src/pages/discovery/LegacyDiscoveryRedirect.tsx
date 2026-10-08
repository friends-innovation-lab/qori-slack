/**
 * LegacyDiscoveryRedirect — NAV-1b
 *
 * Redirects legacy ?type=desk|stakeholder|survey URLs to the new
 * canonical section routes /discovery/desk|stakeholders|surveys.
 *
 * Per STUDY_WORKSPACE_NAV_CORRECTION.md:
 * - discovery?type=desk → discovery/desk
 * - discovery?type=stakeholder → discovery/stakeholders
 * - discovery?type=survey → discovery/surveys
 *
 * Preserves study identity and relevant non-type query parameters.
 * Does not redirect active run or intake workflows.
 */

import { useEffect } from 'react';
import { useSearchParams, useNavigate, useParams, useLocation } from 'react-router';

/** Map legacy type param to canonical path */
const typeToPath: Record<string, string> = {
  desk: '/desk',
  stakeholder: '/stakeholders',
  survey: '/surveys',
};

export function LegacyDiscoveryRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { studyPublicId } = useParams<{ studyPublicId: string }>();
  const location = useLocation();

  useEffect(() => {
    const typeParam = searchParams.get('type');

    // If there's a type param and we're at the discovery root, redirect
    if (typeParam && typeToPath[typeParam]) {
      // Build new URL without type param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('type');
      const queryString = newParams.toString();
      const newPath = `/studies/${studyPublicId}/discovery${typeToPath[typeParam]}${queryString ? `?${queryString}` : ''}`;

      // Replace to avoid adding to history
      navigate(newPath, { replace: true });
    }
  }, [searchParams, studyPublicId, navigate, location.pathname]);

  // Return null - this component only handles redirects
  // The actual DiscoveryHub will render if no redirect is needed
  return null;
}
