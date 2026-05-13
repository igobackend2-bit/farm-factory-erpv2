import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  FileText,
  Search,
  Filter,
  UserCheck,
  UserX,
  MessageSquare,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getPendingOnboardingRequests, approveOnboarding, rejectOnboarding, requestDocumentsCorrection } from '../services/onboardingService';
import type { OnboardingListItem, EmployeeOnboardingRequest, OnboardingStatus } from '../types/prejoining.types';
import { ONBOARDING_STATUS_LABELS, ONBOARDING_STATUS_COLORS } from '../types/prejoining.types';
import { DEPARTMENT_SHORT_CODES } from '../utils/prejoiningPasswordGenerator';

export default function HrAccessPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<OnboardingListItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<EmployeeOnboardingRequest | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'verify' | 'correction' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OnboardingStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const departments = Object.keys(DEPARTMENT_SHORT_CODES);

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const result = await getPendingOnboardingRequests();
      if (result.success && result.data) {
        setRequests(result.data as any);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to load onboarding requests',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load onboarding requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      req.full_name.toLowerCase().includes(query) ||
      req.email.toLowerCase().includes(query) ||
      req.department.toLowerCase().includes(query)
    );
  });

  const handleViewDetails = async (request: OnboardingListItem) => {
    // Fetch full details
    try {
      const { data } = await import('../services/prejoiningOnboardingService').then((mod) =>
        mod.getOnboardingByToken(request.id)
      );
      if (data) {
        setSelectedRequest(data);
        setViewDialogOpen(true);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load details',
        variant: 'destructive',
      });
    }
  };

  const handleAction = (type: 'verify' | 'correction' | 'reject') => {
    setActionType(type);
    setActionReason('');
    setActionDialogOpen(true);
  };

  const executeAction = async () => {
    if (!selectedRequest || !actionType) return;

    if ((actionType === 'correction' || actionType === 'reject') && !actionReason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for this action',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      let result;

      switch (actionType) {
        case 'verify':
          result = await approveOnboarding(selectedRequest.id, actionReason);
          break;
        case 'correction':
          result = await requestDocumentsCorrection(selectedRequest.id, actionReason);
          break;
        case 'reject':
          result = await rejectOnboarding(selectedRequest.id, actionReason);
          break;
      }

      if (result.success) {
        toast({
          title: 'Success',
          description: `Onboarding ${actionType === 'verify' ? 'verified' : actionType === 'correction' ? 'correction requested' : 'rejected'} successfully`,
        });
        setActionDialogOpen(false);
        setViewDialogOpen(false);
        loadRequests();
      } else {
        toast({
          title: 'Failed',
          description: result.error || 'Action failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const openDocument = (url?: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  const getDocumentStatus = (url?: string) => {
    return url ? (
      <Badge variant="default" className="bg-green-600">Uploaded</Badge>
    ) : (
      <Badge variant="outline" className="text-gray-500">Missing</Badge>
    );
  };

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">HR Onboarding Access</h1>
        <p className="text-gray-400">Review and verify employee onboarding submissions</p>
      </div>

      {/* Filters */}
      <Card className="bg-[#1a1a1a] border-gray-800 mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search by name, email, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#0f0f0f] border-gray-700 text-white"
                />
              </div>
            </div>
            <div className="w-[200px]">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OnboardingStatus | 'all')}>
                <SelectTrigger className="bg-[#0f0f0f] border-gray-700 text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-gray-700">
                  <SelectItem value="all" className="text-white">All Status</SelectItem>
                  {Object.entries(ONBOARDING_STATUS_LABELS).map(([status, label]) => (
                    <SelectItem key={status} value={status} className="text-white">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={loadRequests}
              disabled={loading}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card className="bg-[#1a1a1a] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Onboarding Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No onboarding requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Department</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Username</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Documents</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                      <td className="py-3 px-4 text-white">{request.full_name}</td>
                      <td className="py-3 px-4 text-gray-400">{request.email}</td>
                      <td className="py-3 px-4 text-gray-400">{request.department}</td>
                      <td className="py-3 px-4 text-green-400 font-mono text-sm">
                        {request.generated_username || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={ONBOARDING_STATUS_COLORS[request.status]}>
                          {ONBOARDING_STATUS_LABELS[request.status]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {request.hasDocuments ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-600" />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(request)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl bg-[#1a1a1a] border-gray-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Onboarding Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              Review all submitted information and documents
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-[#0f0f0f] rounded-lg">
                <div>
                  <p className="text-gray-400 text-sm">Full Name</p>
                  <p className="text-white font-medium">{selectedRequest.full_name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white font-medium">{selectedRequest.email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Department</p>
                  <p className="text-white font-medium">{selectedRequest.department}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Username</p>
                  <p className="text-green-400 font-mono">{selectedRequest.generated_username}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Status</p>
                  <Badge className={ONBOARDING_STATUS_COLORS[selectedRequest.status]}>
                    {ONBOARDING_STATUS_LABELS[selectedRequest.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Submitted</p>
                  <p className="text-white">{new Date(selectedRequest.updated_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Contact Information</h3>
                <div className="grid grid-cols-3 gap-4 p-4 bg-[#0f0f0f] rounded-lg">
                  <div>
                    <p className="text-gray-400 text-sm">Contact Number</p>
                    <p className="text-white">{selectedRequest.contact_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Emergency Contact</p>
                    <p className="text-white">{selectedRequest.emergency_contact_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Parents Number</p>
                    <p className="text-white">{selectedRequest.parents_number || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Address</h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-[#0f0f0f] rounded-lg">
                  <div>
                    <p className="text-gray-400 text-sm">Permanent Address</p>
                    <p className="text-white">{selectedRequest.permanent_address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Current Address</p>
                    <p className="text-white">{selectedRequest.current_address || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Documents</h3>
                <div className="grid grid-cols-4 gap-3 p-4 bg-[#0f0f0f] rounded-lg">
                  {[
                    { label: 'Aadhaar', url: selectedRequest.aadhaar_url },
                    { label: 'Passbook', url: selectedRequest.passbook_url },
                    { label: '10th Marksheet', url: selectedRequest.marksheet_10_url },
                    { label: '12th Marksheet', url: selectedRequest.marksheet_12_url },
                    { label: 'Degree', url: selectedRequest.degree_marksheet_url },
                    { label: 'Resume', url: selectedRequest.resume_url },
                    { label: 'Photo', url: selectedRequest.photo_url },
                    { label: 'HR Policy', url: selectedRequest.hr_policy_url },
                    { label: 'Offer Letter', url: selectedRequest.offer_letter_url },
                  ].map((doc) => (
                    <div key={doc.label} className="flex items-center justify-between p-2 bg-[#1a1a1a] rounded">
                      <span className="text-sm text-gray-400">{doc.label}</span>
                      {doc.url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDocument(doc.url)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Acknowledgements */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Acknowledgements</h3>
                <div className="flex gap-4 p-4 bg-[#0f0f0f] rounded-lg">
                  <div className="flex items-center gap-2">
                    {selectedRequest.hr_policy_accepted ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-600" />
                    )}
                    <span className="text-gray-400">HR Policy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedRequest.offer_letter_accepted ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-600" />
                    )}
                    <span className="text-gray-400">Offer Letter</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedRequest.status === 'details_submitted' || selectedRequest.status === 'correction_requested' ? (
                <DialogFooter className="gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleAction('reject')}
                    className="border-red-700 text-red-400 hover:bg-red-900/20"
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleAction('correction')}
                    className="border-orange-700 text-orange-400 hover:bg-orange-900/20"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Request Correction
                  </Button>
                  <Button
                    onClick={() => handleAction('verify')}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Verify & Activate
                  </Button>
                </DialogFooter>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {actionType === 'verify' && 'Verify Onboarding'}
              {actionType === 'correction' && 'Request Correction'}
              {actionType === 'reject' && 'Reject Onboarding'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {actionType === 'verify' && 'This will activate the employee account. Are you sure?'}
              {actionType === 'correction' && 'Provide details on what needs to be corrected.'}
              {actionType === 'reject' && 'Provide reason for rejection.'}
            </DialogDescription>
          </DialogHeader>

          {(actionType === 'correction' || actionType === 'reject') && (
            <div className="py-4">
              <Label className="text-gray-300 mb-2 block">
                Reason <span className="text-red-500">*</span>
              </Label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={actionType === 'correction' ? 'What needs to be corrected?' : 'Why is this being rejected?'}
                rows={4}
                className="w-full bg-[#0f0f0f] border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
              disabled={processing}
              className="border-gray-700 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={executeAction}
              disabled={processing}
              className={
                actionType === 'verify'
                  ? 'bg-green-600 hover:bg-green-700'
                  : actionType === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <>
                  {actionType === 'verify' && <CheckCircle className="w-4 h-4 mr-2" />}
                  {actionType === 'correction' && <MessageSquare className="w-4 h-4 mr-2" />}
                  {actionType === 'reject' && <UserX className="w-4 h-4 mr-2" />}
                </>
              )}
              {actionType === 'verify' && 'Confirm Verify'}
              {actionType === 'correction' && 'Send Correction Request'}
              {actionType === 'reject' && 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
