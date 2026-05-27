// users/dto/update-budget.dto.ts
import { IsNumber, Min } from 'class-validator';

export class UpdateBudgetDto {
  @IsNumber()
  @Min(0, { message: 'Ngưỡng chi tiêu không thể là số âm đâu nè! 🌸' })
  budgetLimit: number;
}
