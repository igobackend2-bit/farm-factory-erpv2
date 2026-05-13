import { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Cloud, Users, AlertTriangle, Loader2, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Phase {
  id: string;
  phase_name: string;
}

interface DailyUpdateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phases: Phase[];
  onSubmit: (data: {
    phase_id?: string;
    work_done: string;
    materials_used?: { name: string; quantity: string }[];
    labor_count?: number;
    issues_faced?: string;
    photos?: string[];
    weather_conditions?: string;
    progress_percentage?: number;
  }) => Promise<void>;
  isLoading?: boolean;
}

const weatherOptions = [
  { value: 'sunny', label: '☀️ Sunny' },
  { value: 'cloudy', label: '☁️ Cloudy' },
  { value: 'rainy', label: '🌧️ Rainy' },
  { value: 'stormy', label: '⛈️ Stormy' },
  { value: 'windy', label: '💨 Windy' },
  { value: 'foggy', label: '🌫️ Foggy' },
];

export function DailyUpdateForm({
  open,
  onOpenChange,
  projectId,
  phases,
  onSubmit,
  isLoading,
}: DailyUpdateFormProps) {
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [workDone, setWorkDone] = useState('');
  const [laborCount, setLaborCount] = useState<number>(0);
  const [issues, setIssues] = useState('');
  const [weather, setWeather] = useState('sunny');
  const [progress, setProgress] = useState([0]);
  const [materials, setMaterials] = useState<{ name: string; quantity: string }[]>([]);

  const addMaterial = () => {
    setMaterials([...materials, { name: '', quantity: '' }]);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: 'name' | 'quantity', value: string) => {
    setMaterials(materials.map((m, i) => 
      i === index ? { ...m, [field]: value } : m
    ));
  };

  const handleSubmit = async () => {
    if (!workDone.trim()) return;
    
    await onSubmit({
      phase_id: selectedPhase || undefined,
      work_done: workDone,
      materials_used: materials.filter(m => m.name.trim()),
      labor_count: laborCount,
      issues_faced: issues || undefined,
      weather_conditions: weather,
      progress_percentage: progress[0],
    });
    
    // Reset form
    setSelectedPhase('');
    setWorkDone('');
    setLaborCount(0);
    setIssues('');
    setWeather('sunny');
    setProgress([0]);
    setMaterials([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Daily Site Update
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Phase & Weather */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current Phase</Label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger>
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map(phase => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.phase_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Weather Conditions</Label>
              <Select value={weather} onValueChange={setWeather}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weatherOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Work Done */}
          <div className="space-y-2">
            <Label>Work Done Today *</Label>
            <Textarea
              placeholder="Describe the work completed today..."
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              className="h-24 resize-none"
            />
          </div>

          {/* Progress Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Phase Progress</Label>
              <Badge variant="outline" className="font-mono">
                {progress[0]}%
              </Badge>
            </div>
            <Slider
              value={progress}
              onValueChange={setProgress}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Labor Count */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Labor Count
            </Label>
            <Input
              type="number"
              placeholder="Number of workers"
              value={laborCount || ''}
              onChange={(e) => setLaborCount(Number(e.target.value))}
            />
          </div>

          {/* Materials Used */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Materials Used Today</Label>
              <Button variant="outline" size="sm" onClick={addMaterial}>
                <Plus className="w-3 h-3 mr-1" />
                Add Material
              </Button>
            </div>
            {materials.length > 0 && (
              <div className="space-y-2">
                {materials.map((material, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      placeholder="Material name"
                      value={material.name}
                      onChange={(e) => updateMaterial(index, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Qty"
                      value={material.quantity}
                      onChange={(e) => updateMaterial(index, 'quantity', e.target.value)}
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive"
                      onClick={() => removeMaterial(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Issues */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Issues Faced (Optional)
            </Label>
            <Textarea
              placeholder="Any problems or blockers..."
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              className="h-20 resize-none"
            />
          </div>

          {/* Photo Upload Placeholder */}
          <div className="p-4 border-2 border-dashed border-border/50 rounded-lg text-center">
            <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Photo upload coming soon
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!workDone.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Update'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
